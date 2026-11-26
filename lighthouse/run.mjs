/**
 * Lighthouse runner: `npm run lighthouse` (local) or `npm run lighthouse -- --url <base>` (published).
 *
 * Local: builds the optimized bundle, serves `dist/` with ./server.mjs (Brotli/gzip, the cache headers
 * of vercel.json, SPA fallback), audits each page in each profile RUNS times and writes the reports to
 * lighthouse/reports/. With `--url`, audits that environment instead and writes to
 * lighthouse/reports/production/. Only the median run of each page and profile keeps its HTML and JSON
 * (the summary lists every run); summary.md/summary.json combine the environments measured so far.
 *
 * Env: LH_RUNS, LH_ONLY (e.g. `inicio:mobile,detalhe:desktop`), LH_SKIP_BUILD=1, CHROME_PATH.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import { CATEGORIES, PAGES, PORT, PROFILES, RUNS } from './config.mjs'
import { startStaticServer } from './server.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const reportsRoot = join(root, 'lighthouse', 'reports')
const urlFlag = process.argv.indexOf('--url')
const remoteBase = urlFlag > -1 ? process.argv[urlFlag + 1]?.replace(/\/$/, '') : null
if (urlFlag > -1 && !remoteBase) throw new Error('--url needs a base URL')
const origin = remoteBase ?? `http://localhost:${PORT}`
const reportsDir = remoteBase ? join(reportsRoot, 'production') : reportsRoot
const only = process.env.LH_ONLY?.split(',')
const runsPerCase = Number(process.env.LH_RUNS ?? RUNS)

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  try {
    const found = chromeLauncher.Launcher.getFirstInstallation()
    if (found) return found
  } catch {}
  // Fallback: Chromium bundled with Playwright.
  const base =
    process.env.PLAYWRIGHT_BROWSERS_PATH ??
    join(process.env.LOCALAPPDATA ?? join(os.homedir(), '.cache'), 'ms-playwright')
  if (existsSync(base)) {
    for (const dir of readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().reverse()) {
      for (const rel of ['chrome-win64/chrome.exe', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        if (existsSync(join(base, dir, rel))) return join(base, dir, rel)
      }
    }
  }
  throw new Error('Chrome/Chromium not found. Set CHROME_PATH.')
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function build() {
  if (process.env.LH_SKIP_BUILD) return
  console.log('> npm run build')
  const result = spawnSync('npm run build', { cwd: root, stdio: 'inherit', shell: true })
  if (result.status !== 0) throw new Error('Build failed')
}

async function auditOnce(chromePath, profile, url) {
  // A fresh browser (and profile) per run: default mock scenario, no stored state.
  const chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-extensions'],
  })
  try {
    const result = await lighthouse(url, { port: chrome.port, logLevel: 'error', output: ['html', 'json'] }, profile.config)
    const version = (await (await fetch(`http://127.0.0.1:${chrome.port}/json/version`)).json()).Browser
    return { lhr: result.lhr, html: result.report[0], json: result.report[1], browser: version }
  } finally {
    await chrome.kill()
  }
}

const score = (lhr, id) => Math.round((lhr.categories[id]?.score ?? 0) * 100)
const metric = (lhr, id) => lhr.audits[id].numericValue

async function main() {
  let server
  if (!remoteBase) {
    build()
    server = await startStaticServer(join(root, 'dist'), PORT)
  }
  mkdirSync(reportsDir, { recursive: true })
  // Clear this environment's files only (the published-environment reports live in a subfolder).
  for (const f of readdirSync(reportsDir)) if (/.(html|json)$/.test(f) && f !== 'summary.json') rmSync(join(reportsDir, f))
  const chromePath = findChrome()
  let browser = ''
  try {
    const rows = []
        for (const page of PAGES) {
      for (const profile of PROFILES) {
        if (only && !only.includes(`${page.id}:${profile.id}`)) continue
        const runs = []
        const files = []
        for (let i = 1; i <= runsPerCase; i++) {
          const { lhr, html, json, browser: b } = await auditOnce(chromePath, profile, origin + page.path)
          browser = b
          const base = `${page.id}-${profile.id}-run${i}`
          files.push({ base, html, json })
          const run = {
            run: i,
            performance: score(lhr, 'performance'),
            accessibility: score(lhr, 'accessibility'),
            bestPractices: score(lhr, 'best-practices'),
            seo: score(lhr, 'seo'),
            lcp: metric(lhr, 'largest-contentful-paint'),
            cls: metric(lhr, 'cumulative-layout-shift'),
            tbt: metric(lhr, 'total-blocking-time'),
            report: base,
            lighthouseVersion: lhr.lighthouseVersion,
          }
          runs.push(run)
          console.log(
            `${page.id} ${profile.id} #${i}: perf ${run.performance} a11y ${run.accessibility} bp ${run.bestPractices} seo ${run.seo} | LCP ${Math.round(run.lcp)} ms CLS ${run.cls.toFixed(3)} TBT ${Math.round(run.tbt)} ms`,
          )
        }
        // The median run (by Performance, then LCP) keeps its reports; the others are only in the summary.
        const ranked = [...runs].sort((a, b) => a.performance - b.performance || b.lcp - a.lcp)
        const medianRun = ranked[Math.floor(ranked.length / 2)]
        for (const run of runs) run.isMedianReport = run === medianRun
        const keep = files.find((f) => f.base === medianRun.report)
        writeFileSync(join(reportsDir, `${keep.base}.html`), keep.html)
        writeFileSync(join(reportsDir, `${keep.base}.json`), keep.json)
        const med = (key) => median(runs.map((r) => r[key]))
        rows.push({
          page: page.label,
          path: page.path,
          profile: profile.label,
          median: {
            performance: med('performance'),
            accessibility: med('accessibility'),
            bestPractices: med('bestPractices'),
            seo: med('seo'),
            lcpMs: Math.round(med('lcp')),
            cls: Number(med('cls').toFixed(3)),
            tbtMs: Math.round(med('tbt')),
          },
          runs,
        })
      }
    }
    const cpus = os.cpus()
    const env = {
      label: remoteBase ? `Produção (${remoteBase})` : 'Local, build servido com compressão (Brotli) e cabeçalhos do vercel.json',
      generatedAt: new Date().toISOString(),
      lighthouse: rows[0]?.runs[0].lighthouseVersion,
      chrome: browser,
      node: process.version,
      system: `${os.type()} ${os.release()} (${os.platform()} ${os.arch()})`,
      hardware: `${cpus[0]?.model.trim()}, ${cpus.length} threads, ${(os.totalmem() / 1024 ** 3).toFixed(1)} GB RAM`,
      conditions: {
        target: remoteBase ?? 'npm run build (production, mocks on) served by lighthouse/server.mjs on localhost, HTTP/1.1, Brotli',
        scenario: 'default (fresh browser profile per run, no ?scenario)',
        throttling:
          'simulated (Lighthouse default). Mobile: 4x CPU, 150 ms RTT, 1.6 Mbps. Desktop: 1x CPU, 40 ms RTT, 10 Mbps',
        runsPerCase,
        categories: CATEGORIES.join(', '),
      },
    }
    writeFileSync(join(reportsDir, 'summary.json'), JSON.stringify({ environment: env, results: rows }, null, 2))
    writeCombinedSummary()
    console.log(`\nReports in ${reportsDir}`)
  } finally {
    server?.close()
    server?.closeAllConnections?.()
  }
}

function load(dir) {
  const file = join(dir, 'summary.json')
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
}

function writeCombinedSummary() {
  const sections = [
    { dir: reportsRoot, rel: '.', data: load(reportsRoot) },
    { dir: join(reportsRoot, 'production'), rel: './production', data: load(join(reportsRoot, 'production')) },
  ].filter((s) => s.data)
  const out = ['# Lighthouse: medianas', '']
  for (const { rel, data } of sections) {
    const { environment: env, results: rows } = data
    out.push(
      `## ${env.label}`,
      '',
      `Gerado em ${env.generatedAt}. Mediana de ${env.conditions.runsPerCase} execuções por página e perfil.`,
      '',
      '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |',
      '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
      ...rows.map((r) => {
        const m = r.median
        return `| ${r.page} | ${r.profile} | ${m.performance} | ${m.accessibility} | ${m.bestPractices} | ${m.seo} | ${(m.lcpMs / 1000).toFixed(2)} s | ${m.cls} | ${m.tbtMs} ms |`
      }),
      '',
      'Execuções individuais (o relatório HTML/JSON é o da execução mediana):',
      '',
      '| Página | Perfil | # | Perf | A11y | BP | SEO | LCP (ms) | CLS | TBT (ms) | Relatório |',
      '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
      ...rows.flatMap((r) =>
        r.runs.map(
          (x) =>
            `| ${r.page} | ${r.profile} | ${x.run} | ${x.performance} | ${x.accessibility} | ${x.bestPractices} | ${x.seo} | ${Math.round(x.lcp)} | ${x.cls.toFixed(3)} | ${Math.round(x.tbt)} | ${x.isMedianReport ? `[html](${rel}/${x.report}.html), [json](${rel}/${x.report}.json)` : ''} |`,
        ),
      ),
      '',
      '### Ambiente e condições',
      '',
      `- Lighthouse: ${env.lighthouse}`,
      `- Chrome: ${env.chrome}`,
      `- Node: ${env.node}`,
      `- Sistema: ${env.system}`,
      `- Hardware: ${env.hardware}`,
      `- Alvo: ${env.conditions.target}`,
      `- Cenário: ${env.conditions.scenario}`,
      `- Throttling: ${env.conditions.throttling}`,
      '',
    )
  }
  writeFileSync(join(reportsRoot, 'summary.md'), out.join('\n'))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
