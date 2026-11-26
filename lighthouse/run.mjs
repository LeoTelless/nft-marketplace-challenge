/**
 * Lighthouse runner: `npm run lighthouse`.
 * Builds the optimized bundle, serves it with `vite preview`, audits each page in each profile
 * RUNS times and writes HTML + JSON reports and the medians summary to lighthouse/reports/.
 *
 * Env: LH_RUNS (runs per case), LH_ONLY (e.g. `inicio:mobile,detalhe:desktop`),
 * LH_OUT (output directory), LH_SKIP_BUILD=1, CHROME_PATH.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import { CATEGORIES, PAGES, PORT, PROFILES, RUNS } from './config.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const reportsDir = process.env.LH_OUT ?? join(root, 'lighthouse', 'reports')
const origin = `http://localhost:${PORT}`
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

async function waitFor(url, timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`Timeout waiting for ${url}`)
}

function build() {
  if (process.env.LH_SKIP_BUILD) return
  console.log('> npm run build')
  const result = spawnSync('npm run build', { cwd: root, stdio: 'inherit', shell: true })
  if (result.status !== 0) throw new Error('Build failed')
}

function startPreview() {
  return spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: root,
    stdio: 'ignore',
  })
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
  build()
  rmSync(reportsDir, { recursive: true, force: true })
  mkdirSync(reportsDir, { recursive: true })
  const preview = startPreview()
  const chromePath = findChrome()
  let browser = ''
  try {
    await waitFor(origin)
    const rows = []
    for (const page of PAGES) {
      for (const profile of PROFILES) {
        if (only && !only.includes(`${page.id}:${profile.id}`)) continue
        const runs = []
        for (let i = 1; i <= runsPerCase; i++) {
          const { lhr, html, json, browser: b } = await auditOnce(chromePath, profile, origin + page.path)
          browser = b
          const base = `${page.id}-${profile.id}-run${i}`
          writeFileSync(join(reportsDir, `${base}.html`), html)
          writeFileSync(join(reportsDir, `${base}.json`), json)
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
      generatedAt: new Date().toISOString(),
      lighthouse: rows[0]?.runs[0].lighthouseVersion,
      chrome: browser,
      node: process.version,
      system: `${os.type()} ${os.release()} (${os.platform()} ${os.arch()})`,
      hardware: `${cpus[0]?.model.trim()}, ${cpus.length} threads, ${(os.totalmem() / 1024 ** 3).toFixed(1)} GB RAM`,
      conditions: {
        build: 'npm run build (production, mocks on) served by vite preview',
        scenario: 'default (fresh browser profile per run, no ?scenario)',
        throttling:
          'simulated (Lighthouse default). Mobile: 4x CPU, 150 ms RTT, 1.6 Mbps. Desktop: 1x CPU, 40 ms RTT, 10 Mbps',
        runsPerCase,
        categories: CATEGORIES.join(', '),
      },
    }
    writeFileSync(join(reportsDir, 'summary.json'), JSON.stringify({ environment: env, results: rows }, null, 2))
    writeFileSync(join(reportsDir, 'summary.md'), toMarkdown(env, rows))
    console.log(`\nReports in ${reportsDir}`)
  } finally {
    preview.kill()
  }
}

function toMarkdown(env, rows) {
  return [
    '# Lighthouse: medianas',
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
    '## Execuções individuais',
    '',
    '| Página | Perfil | # | Perf | A11y | BP | SEO | LCP (ms) | CLS | TBT (ms) | Relatório |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...rows.flatMap((r) =>
      r.runs.map(
        (x) =>
          `| ${r.page} | ${r.profile} | ${x.run} | ${x.performance} | ${x.accessibility} | ${x.bestPractices} | ${x.seo} | ${Math.round(x.lcp)} | ${x.cls.toFixed(3)} | ${Math.round(x.tbt)} | [html](./${x.report}.html), [json](./${x.report}.json) |`,
      ),
    ),
    '',
    '## Ambiente e condições',
    '',
    `- Lighthouse: ${env.lighthouse}`,
    `- Chrome: ${env.chrome}`,
    `- Node: ${env.node}`,
    `- Sistema: ${env.system}`,
    `- Hardware: ${env.hardware}`,
    `- Build: ${env.conditions.build}`,
    `- Cenário: ${env.conditions.scenario}`,
    `- Throttling: ${env.conditions.throttling}`,
    '',
  ].join('\n')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
