#!/usr/bin/env node
// Cache local do layout do Figma em design/. Idempotente: pula o que já existe.
// Uso: node --env-file=.env.local scripts/figma-dump.mjs
// Variáveis: FIGMA_TOKEN, FIGMA_FILE_KEY (cópia), FIGMA_ORIGINAL_KEY (só comentários).
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const D = (...p) => join(ROOT, 'design', ...p)
const API = 'https://api.figma.com/v1'
const { FIGMA_TOKEN, FIGMA_FILE_KEY, FIGMA_ORIGINAL_KEY } = process.env
if (!FIGMA_TOKEN || !FIGMA_FILE_KEY) throw new Error('Defina FIGMA_TOKEN e FIGMA_FILE_KEY')

// Regras tela do enunciado -> frame (testadas contra "<pagina> / <frame>", minúsculas)
const SCREEN_RULES = JSON.parse(
  await readFile(join(ROOT, 'scripts', 'figma-screens.json'), 'utf8').catch(() => '[]'),
)

let calls = 0
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const exists = (p) => access(p).then(() => true, () => false)
const writeJson = async (p, o) => {
  await mkdir(dirname(p), { recursive: true })
  await writeFile(p, JSON.stringify(o, null, 2))
}
const slugify = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sem-nome'

let lastCall = 0
async function figma(path, { optional = false } = {}) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const wait = 6500 - (Date.now() - lastCall)
    if (wait > 0) await sleep(wait)
    lastCall = Date.now()
    calls++
    const res = await fetch(API + path, { headers: { 'X-Figma-Token': FIGMA_TOKEN } })
    if (res.status === 429) {
      const ra = Number(res.headers.get('retry-after')) || 30
      console.log(`429 em ${path.split('?')[0]}; aguardando ${ra}s`)
      await sleep(Math.min(ra, 120) * 1000 + 500)
      continue
    }
    const text = await res.text()
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ${path.split('?')[0]}: ${text.slice(0, 300)}`)
      err.status = res.status
      if (optional) return { error: err.message, status: res.status }
      throw err
    }
    return JSON.parse(text)
  }
  throw new Error('Rate limit persistente em ' + path)
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download ${res.status} ${url.slice(0, 80)}`)
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, Buffer.from(await res.arrayBuffer()))
}

// ---------- 1. file.json ----------
let file
if (await exists(D('raw', 'file.json'))) {
  file = JSON.parse(await readFile(D('raw', 'file.json'), 'utf8'))
} else {
  file = await figma(`/files/${FIGMA_FILE_KEY}`)
  await writeJson(D('raw', 'file.json'), file)
  console.log('file.json salvo')
}

// ---------- frames de primeiro nível ----------
const FRAME_TYPES = new Set(['FRAME', 'COMPONENT', 'COMPONENT_SET'])
const frames = []
const usedSlugs = new Set()
for (const page of file.document.children) {
  const pageSlug = slugify(page.name)
  const visit = (n, section) => {
    if (n.type === 'SECTION') return n.children?.forEach((c) => visit(c, n.name))
    if (!FRAME_TYPES.has(n.type)) return
    let slug = slugify(n.name)
    if (usedSlugs.has(slug)) slug = `${slug}-${n.id.replace(/[:;]/g, '_')}`
    usedSlugs.add(slug)
    frames.push({ node: n, page: page.name, pageSlug, section: section ?? null, slug })
  }
  page.children?.forEach((c) => visit(c))
}
console.log(`${file.document.children.length} páginas, ${frames.length} frames`)

// ---------- 2. PNGs ----------
const pngPath = (f) => D('frames', f.pageSlug, `${f.slug}.png`)
const todo = []
for (const f of frames) if (!(await exists(pngPath(f)))) todo.push(f)
const BATCH = 8
async function renderBatch(list, scale) {
  const ids = list.map((f) => f.node.id).join(',')
  const r = await figma(
    `/images/${FIGMA_FILE_KEY}?ids=${encodeURIComponent(ids)}&format=png&scale=${scale}`,
    { optional: true },
  )
  return r
}
for (let i = 0; i < todo.length; i += BATCH) {
  const chunk = todo.slice(i, i + BATCH)
  let r = await renderBatch(chunk, 2)
  let scale = 2
  const missing = () => chunk.filter((f) => !r.images?.[f.node.id])
  if (r.error || missing().length) {
    // fallback: um a um, @2x e depois @1x
    r = { images: {} }
    for (const f of chunk) {
      for (const s of [2, 1]) {
        const one = await renderBatch([f], s)
        const url = one.images?.[f.node.id]
        if (url) {
          r.images[f.node.id] = url
          f.scale = s
          break
        }
      }
    }
  }
  for (const f of chunk) {
    const url = r.images?.[f.node.id]
    if (!url) {
      console.warn('sem render:', f.page, f.node.name)
      continue
    }
    f.scale ??= scale
    await download(url, pngPath(f))
  }
  console.log(`PNGs ${Math.min(i + BATCH, todo.length)}/${todo.length}`)
}

// ---------- helpers de simplificação ----------
const hex = (c, extra = 1) => {
  const to = (v) => Math.round(v * 255).toString(16).padStart(2, '0')
  const a = (c.a ?? 1) * extra
  const h = `#${to(c.r)}${to(c.g)}${to(c.b)}`.toUpperCase()
  return a >= 0.999 ? h : `${h}${to(a).toUpperCase()}`
}
const paint = (p) => {
  if (p.visible === false) return null
  if (p.type === 'SOLID') return { type: 'SOLID', color: hex(p.color, p.opacity ?? 1) }
  if (p.type.startsWith('GRADIENT'))
    return {
      type: p.type,
      stops: p.gradientStops.map((s) => ({ pos: +s.position.toFixed(3), color: hex(s.color, p.opacity ?? 1) })),
      handles: p.gradientHandlePositions?.map((h) => [+h.x.toFixed(3), +h.y.toFixed(3)]),
    }
  if (p.type === 'IMAGE')
    return { type: 'IMAGE', imageRef: p.imageRef, scaleMode: p.scaleMode, opacity: p.opacity }
  return { type: p.type }
}
const r2 = (n) => Math.round(n * 100) / 100

function simplify(n, origin) {
  const o = { id: n.id, name: n.name, type: n.type }
  if (n.visible === false) o.visible = false
  const b = n.absoluteBoundingBox
  if (b)
    o.box = {
      x: r2(b.x - origin.x),
      y: r2(b.y - origin.y),
      w: r2(b.width),
      h: r2(b.height),
    }
  if (n.componentId) o.componentId = n.componentId
  if (n.layoutMode && n.layoutMode !== 'NONE') {
    o.layout = {
      mode: n.layoutMode,
      wrap: n.layoutWrap === 'WRAP' || undefined,
      primaryAlign: n.primaryAxisAlignItems,
      counterAlign: n.counterAxisAlignItems,
      gap: n.itemSpacing,
      counterGap: n.counterAxisSpacing,
      padding: [n.paddingTop ?? 0, n.paddingRight ?? 0, n.paddingBottom ?? 0, n.paddingLeft ?? 0],
    }
  }
  if (n.layoutSizingHorizontal || n.layoutSizingVertical)
    o.sizing = { h: n.layoutSizingHorizontal, v: n.layoutSizingVertical }
  if (n.layoutAlign && n.layoutAlign !== 'INHERIT') o.layoutAlign = n.layoutAlign
  if (n.layoutGrow) o.layoutGrow = n.layoutGrow
  if (n.layoutPositioning === 'ABSOLUTE') o.positioning = 'ABSOLUTE'
  if (n.constraints) o.constraints = n.constraints
  if (n.clipsContent) o.clip = true
  const fills = n.fills?.map(paint).filter(Boolean)
  if (fills?.length) o.fills = fills
  const strokes = n.strokes?.map(paint).filter(Boolean)
  if (strokes?.length) {
    o.strokes = strokes
    o.strokeWeight = n.strokeWeight
    if (n.individualStrokeWeights) o.strokeWeights = n.individualStrokeWeights
    o.strokeAlign = n.strokeAlign
    if (n.strokeDashes?.length) o.strokeDashes = n.strokeDashes
  }
  if (n.rectangleCornerRadii) o.radius = n.rectangleCornerRadii
  else if (n.cornerRadius) o.radius = n.cornerRadius
  const fx = n.effects
    ?.filter((e) => e.visible !== false)
    .map((e) => ({
      type: e.type,
      color: e.color && hex(e.color),
      offset: e.offset && [e.offset.x, e.offset.y],
      radius: e.radius,
      spread: e.spread,
    }))
  if (fx?.length) o.effects = fx
  if (n.opacity !== undefined && n.opacity < 1) o.opacity = r2(n.opacity)
  if (n.blendMode && !['NORMAL', 'PASS_THROUGH'].includes(n.blendMode)) o.blendMode = n.blendMode
  if (n.type === 'TEXT') {
    const s = n.style ?? {}
    o.text = {
      characters: n.characters,
      fontFamily: s.fontFamily,
      fontWeight: s.fontWeight,
      fontSize: s.fontSize,
      lineHeightPx: s.lineHeightPx && r2(s.lineHeightPx),
      lineHeightPercent: s.lineHeightUnit === 'INTRINSIC_%' ? undefined : s.lineHeightPercentFontSize && r2(s.lineHeightPercentFontSize),
      letterSpacing: s.letterSpacing && r2(s.letterSpacing),
      align: s.textAlignHorizontal,
      valign: s.textAlignVertical,
      textCase: s.textCase,
      decoration: s.textDecoration,
      italic: s.italic || undefined,
      autoResize: n.textAutoResize || s.textAutoResize,
    }
  }
  if (n.styles) o.styleRefs = n.styles
  if (n.children?.length) o.children = n.children.map((c) => simplify(c, origin))
  return o
}

// ---------- 3. nodes/*.json ----------
for (const f of frames) {
  const p = D('nodes', `${f.slug}.json`)
  if (await exists(p)) continue
  const b = f.node.absoluteBoundingBox ?? { x: 0, y: 0 }
  await writeJson(p, { page: f.page, section: f.section, ...simplify(f.node, b) })
}
console.log('nodes/ ok')

// ---------- varredura global ----------
const walk = (n, fn, depth = 0, parent = null, top = null) => {
  fn(n, depth, parent, top)
  n.children?.forEach((c) => walk(c, fn, depth + 1, n, top ?? c))
}
const VECTOR = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'ELLIPSE', 'REGULAR_POLYGON', 'RECTANGLE'])
const PURE_VECTOR = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'REGULAR_POLYGON'])
const nodeFrame = new Map() // id -> {frame, path}
const components = file.components ?? {}
const compName = (id) => components[id]?.name
for (const f of frames) {
  const rec = (n, path) => {
    nodeFrame.set(n.id, { frame: f, path })
    n.children?.forEach((c) => rec(c, [...path, n.name]))
  }
  rec(f.node, [])
}

// ---------- 4. assets ----------
const hasVector = (n) => PURE_VECTOR.has(n.type) || n.children?.some(hasVector)
const onlyShapes = (n) =>
  (VECTOR.has(n.type) || (n.children?.length && n.children.every(onlyShapes))) && n.type !== 'TEXT'
const iconCandidates = new Map() // key -> {ids:[], name, w, h}
// pais para a checagem de aninhamento
for (const f of frames) walk(f.node, (n) => n.children?.forEach((c) => { const r = nodeFrame.get(c.id); if (r) r.parentNode = n }))
// refaz candidatos agora com parentNode disponível
for (const f of frames) {
  walk(f.node, (n, depth) => {
    if (depth === 0 || n.visible === false) return
    const b = n.absoluteBoundingBox
    if (!b) return
    const small = b.width <= 128 && b.height <= 128
    const isShapeContainer = ['INSTANCE', 'COMPONENT', 'FRAME', 'GROUP'].includes(n.type)
    const iconish = (PURE_VECTOR.has(n.type) && small) || (isShapeContainer && small && hasVector(n) && onlyShapes(n))
    if (!iconish) return
    let p = nodeFrame.get(n.id)?.parentNode
    while (p) {
      const pb = p.absoluteBoundingBox
      const pc = ['INSTANCE', 'COMPONENT', 'FRAME', 'GROUP'].includes(p.type)
      if (pc && pb && pb.width <= 128 && pb.height <= 128 && hasVector(p) && onlyShapes(p)) return
      p = nodeFrame.get(p.id)?.parentNode
    }
    const key = n.componentId ? `c:${n.componentId}` : `n:${n.name}:${Math.round(b.width)}x${Math.round(b.height)}`
    const e = iconCandidates.get(key) ?? { key, ids: [], name: compName(n.componentId) ?? n.name, w: Math.round(b.width), h: Math.round(b.height) }
    e.ids.push(n.id)
    iconCandidates.set(key, e)
  })
}
const manifestPath = D('assets', 'manifest.json')
const manifest = (await exists(manifestPath))
  ? JSON.parse(await readFile(manifestPath, 'utf8'))
  : { svgs: [], images: [] }
const doneKeys = new Set(manifest.svgs.map((s) => s.key))
const usedNames = new Set(manifest.svgs.map((s) => s.file))
const svgTodo = [...iconCandidates.values()].filter((e) => !doneKeys.has(e.key))
console.log(`ícones únicos: ${iconCandidates.size} (pendentes ${svgTodo.length})`)
for (let i = 0; i < svgTodo.length; i += 40) {
  const chunk = svgTodo.slice(i, i + 40)
  const r = await figma(
    `/images/${FIGMA_FILE_KEY}?ids=${encodeURIComponent(chunk.map((e) => e.ids[0]).join(','))}&format=svg&svg_include_id=false`,
    { optional: true },
  )
  if (r.error) { console.warn('svg falhou:', r.error); continue }
  for (const e of chunk) {
    const url = r.images?.[e.ids[0]]
    if (!url) continue
    let name = slugify(e.name)
    let file_ = `${name}.svg`
    if (usedNames.has(file_)) file_ = `${name}-${e.w}x${e.h}.svg`
    if (usedNames.has(file_)) file_ = `${name}-${e.ids[0].replace(/[:;]/g, '_')}.svg`
    usedNames.add(file_)
    await download(url, D('assets', file_))
    manifest.svgs.push({ key: e.key, file: `assets/${file_}`, name: e.name, size: `${e.w}x${e.h}`, uses: e.ids.length, nodeIds: e.ids.slice(0, 30) })
  }
}

// imagens de preenchimento
const imageRefs = new Map() // ref -> nodes
for (const f of frames)
  walk(f.node, (n) => {
    for (const p of n.fills ?? []) if (p.type === 'IMAGE' && p.imageRef) {
      const a = imageRefs.get(p.imageRef) ?? []
      a.push({ id: n.id, name: n.name, frame: f.node.name })
      imageRefs.set(p.imageRef, a)
    }
  })
const haveImgs = new Set(manifest.images.map((i) => i.imageRef))
if ([...imageRefs.keys()].some((r) => !haveImgs.has(r))) {
  const r = await figma(`/files/${FIGMA_FILE_KEY}/images`)
  const map = r.meta?.images ?? {}
  for (const [ref, nodes] of imageRefs) {
    if (haveImgs.has(ref) || !map[ref]) continue
    const res = await fetch(map[ref])
    const buf = Buffer.from(await res.arrayBuffer())
    const ct = res.headers.get('content-type') ?? ''
    const ext = ct.includes('jpeg') ? 'jpg' : ct.includes('webp') ? 'webp' : ct.includes('svg') ? 'svg' : 'png'
    const fn = `images/${ref}.${ext}`
    await mkdir(D('assets', 'images'), { recursive: true })
    await writeFile(D('assets', fn), buf)
    manifest.images.push({ imageRef: ref, file: `assets/${fn}`, bytes: buf.length, nodes: nodes.slice(0, 20), uses: nodes.length })
  }
}
await writeJson(manifestPath, manifest)

// ---------- 5. tokens ----------
const colors = new Map(), texts = new Map(), radii = new Map(), shadows = new Map(), spacing = new Map()
const bump = (m, k, extra) => { const e = m.get(k) ?? { count: 0, ...extra }; e.count++; m.set(k, e) }
for (const f of frames)
  walk(f.node, (n) => {
    if (n.visible === false) return
    for (const p of n.fills ?? []) { const s = paint(p); if (s?.type === 'SOLID' && n.type !== 'TEXT') bump(colors, s.color, { as: 'fill' }) }
    if (n.type === 'TEXT') for (const p of n.fills ?? []) { const s = paint(p); if (s?.type === 'SOLID') bump(colors, s.color, {}) }
    for (const p of n.strokes ?? []) { const s = paint(p); if (s?.type === 'SOLID') bump(colors, s.color, {}) }
    if (n.type === 'TEXT' && n.style) {
      const s = n.style
      const k = `${s.fontFamily}|${s.fontWeight}|${s.fontSize}|${r2(s.lineHeightPx ?? 0)}|${r2(s.letterSpacing ?? 0)}`
      bump(texts, k, { fontFamily: s.fontFamily, fontWeight: s.fontWeight, fontSize: s.fontSize, lineHeightPx: r2(s.lineHeightPx ?? 0), letterSpacing: r2(s.letterSpacing ?? 0), example: (n.characters ?? '').slice(0, 30) })
    }
    const rad = n.rectangleCornerRadii ? n.rectangleCornerRadii.join('/') : n.cornerRadius
    if (rad) bump(radii, String(rad), { value: rad })
    for (const e of n.effects ?? []) if (e.visible !== false && /SHADOW/.test(e.type)) {
      const k = `${e.type} ${e.offset.x} ${e.offset.y} ${e.radius} ${e.spread ?? 0} ${hex(e.color)}`
      bump(shadows, k, { type: e.type, x: e.offset.x, y: e.offset.y, blur: e.radius, spread: e.spread ?? 0, color: hex(e.color) })
    }
    if (n.layoutMode && n.layoutMode !== 'NONE') {
      for (const v of [n.itemSpacing, n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft]) if (v) bump(spacing, String(v), { value: v })
    }
  })
const sortDesc = (m) => [...m.entries()].map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.count - a.count)
const tokens = {
  colors: sortDesc(colors).map(({ key, count }) => ({ hex: key, count })),
  textStyles: sortDesc(texts).map(({ key: _key, ...r }) => r),
  radii: sortDesc(radii).map(({ key: _key, ...r }) => r),
  shadows: sortDesc(shadows).map(({ key: _key, ...r }) => r),
  spacing: sortDesc(spacing).map(({ key: _key, ...r }) => r),
  namedStyles: Object.entries(file.styles ?? {}).map(([id, s]) => ({ id, name: s.name, type: s.styleType })),
  variables: 'não disponível (API de variáveis exige plano Enterprise); nenhuma variável publicada no dump',
}
await writeJson(D('tokens.json'), tokens)

// ---------- 6. comentários do original ----------
let comments = []
let commentsError = null
if (FIGMA_ORIGINAL_KEY) {
  if (await exists(D('raw', 'comments-original.json'))) {
    comments = JSON.parse(await readFile(D('raw', 'comments-original.json'), 'utf8')).comments ?? []
  } else {
    const r = await figma(`/files/${FIGMA_ORIGINAL_KEY}/comments`, { optional: true })
    if (r.error) commentsError = r.error
    else { comments = r.comments ?? []; await writeJson(D('raw', 'comments-original.json'), r) }
  }
}
const nodeIndex = new Map()
for (const f of frames) walk(f.node, (n) => nodeIndex.set(n.id, n.name))
const outComments = comments.map((c) => {
  const m = c.client_meta ?? {}
  const nid = m.node_id
  const hit = nid ? nodeFrame.get(nid) : null
  return {
    id: c.id,
    parentId: c.parent_id || null,
    author: c.user?.handle,
    createdAt: c.created_at,
    resolved: !!c.resolved_at,
    resolvedAt: c.resolved_at ?? null,
    message: c.message,
    anchor: nid
      ? { nodeId: nid, nodeName: nodeIndex.get(nid) ?? null, frame: hit?.frame.node.name ?? null, page: hit?.frame.page ?? null, resolvedInCopy: !!hit, offset: m.node_offset }
      : { x: m.x, y: m.y },
  }
})
await writeJson(D('comments.json'), commentsError ? { error: commentsError, comments: [] } : outComments)
{
  let md = '# Comentários do arquivo original\n\n'
  if (commentsError) md += `Erro ao buscar: \`${commentsError}\`\n`
  else {
    const roots = outComments.filter((c) => !c.parentId)
    md += `${outComments.length} comentários (${roots.length} threads; ${roots.filter((c) => !c.resolved).length} abertos).\n\n`
    for (const c of roots) {
      const a = c.anchor
      const where = a.nodeId ? `nó \`${a.nodeId}\`${a.nodeName ? ` "${a.nodeName}"` : ''}${a.frame ? ` (frame "${a.frame}", página "${a.page}")` : ' (id não encontrado na cópia)'}` : `coordenadas (${a.x}, ${a.y})`
      md += `## ${c.author} em ${c.createdAt?.slice(0, 10)} — ${c.resolved ? 'resolvido' : 'aberto'}\n\nAncorado em: ${where}\n\n> ${c.message.replace(/\n/g, '\n> ')}\n\n`
      for (const r of outComments.filter((x) => x.parentId === c.id))
        md += `- Resposta de ${r.author} (${r.createdAt?.slice(0, 10)}): ${r.message.replace(/\n/g, ' ')}\n`
      md += '\n'
    }
  }
  await writeFile(D('COMMENTS.md'), md)
}

// ---------- 7. INDEX.md ----------
const screenOf = (f) => {
  const s = `${f.page} / ${f.node.name}`.toLowerCase()
  for (const r of SCREEN_RULES) if (new RegExp(r.match, 'i').test(s)) return r.screen
  return '?'
}
const kindOf = (f) => {
  const w = f.node.absoluteBoundingBox?.width ?? 0
  return w <= 600 ? 'mobile' : 'desktop'
}
const fonts = new Map()
for (const t of tokens.textStyles) {
  const e = fonts.get(t.fontFamily) ?? { weights: new Set(), count: 0 }
  e.weights.add(t.fontWeight); e.count += t.count; fonts.set(t.fontFamily, e)
}
const instCount = new Map()
for (const f of frames) walk(f.node, (n) => { if (n.type === 'INSTANCE' && n.componentId) instCount.set(n.componentId, (instCount.get(n.componentId) ?? 0) + 1) })
let md = `# Índice do design (cache do Figma)\n\nGerado por \`scripts/figma-dump.mjs\`. PNG @2x em \`design/frames\`, árvore simplificada em \`design/nodes\`, tokens em \`design/tokens.json\`, assets em \`design/assets\`.\n\n## Frames\n\n`
for (const page of file.document.children) {
  md += `### Página: ${page.name}\n\n| Frame | Tamanho | Tipo | Tela do enunciado | PNG | JSON |\n| --- | --- | --- | --- | --- | --- |\n`
  for (const f of frames.filter((x) => x.page === page.name)) {
    const b = f.node.absoluteBoundingBox ?? {}
    md += `| ${f.node.name} (\`${f.node.id}\`) | ${Math.round(b.width)}x${Math.round(b.height)} | ${kindOf(f)} | ${screenOf(f)} | \`design/frames/${f.pageSlug}/${f.slug}.png\` | \`design/nodes/${f.slug}.json\` |\n`
  }
  md += '\n'
}
md += `## Fontes\n\n`
for (const [fam, e] of [...fonts.entries()].sort((a, b) => b[1].count - a[1].count))
  md += `- ${fam}: pesos ${[...e.weights].sort().join(', ')} (${e.count} usos)\n`
md += `\nVerifique se cada família está no Google Fonts (ver relatório do agente).\n\n## Componentes mais usados (instâncias)\n\n`
for (const [id, c] of [...instCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25))
  md += `- ${compName(id) ?? id}: ${c}\n`
md += `\n## Assets\n\n- SVGs: ${manifest.svgs.length} (\`design/assets/*.svg\`)\n- Imagens: ${manifest.images.length} (\`design/assets/images/\`)\n- Mapeamento: \`design/assets/manifest.json\`\n`
await writeFile(D('INDEX.md'), md)

console.log(`Concluído. Chamadas à API Figma: ${calls}. SVGs ${manifest.svgs.length}, imagens ${manifest.images.length}, comentários ${comments.length}${commentsError ? ' (erro: ' + commentsError + ')' : ''}`)
