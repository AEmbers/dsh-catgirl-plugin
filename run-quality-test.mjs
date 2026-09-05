// Portable quality comparison runner. Writes usage, output, overlay, and metadata artifacts.
// Usage: npm run test:quality -- <label> <base|lite> <task>
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url))
const PLUGIN_VERSION = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf8')).version
const DSH_BIN = process.env.DSH_BIN ?? 'dsh'
const OUTPUT_DIR = process.env.BENCHMARK_OUTPUT_DIR ?? join(tmpdir(), 'dsh-catgirl-benchmarks')
const [rawLabel, config, ...taskWords] = process.argv.slice(2)
const task = taskWords.join(' ').trim()

if (!rawLabel || !['base', 'lite'].includes(config) || !task) {
  console.error('Usage: npm run test:quality -- <label> <base|lite> <task>')
  process.exit(2)
}

const label = rawLabel.replace(/[^a-zA-Z0-9_-]/g, '-')
const stem = `quality-${label}-${config}`
const usageFile = join(OUTPUT_DIR, `${stem}.usage.jsonl`)
const outputFile = join(OUTPUT_DIR, `${stem}.out.txt`)
const overlayFile = join(OUTPUT_DIR, `${stem}.overlay.yml`)
const metadataFile = join(OUTPUT_DIR, `${stem}.meta.json`)
const yamlQuote = value => `'${String(value).replaceAll("'", "''")}'`

mkdirSync(OUTPUT_DIR, { recursive: true })
rmSync(usageFile, { force: true })

const rows = [
  '- insert:',
  '    - id: usage-meter',
  `      name: ${yamlQuote(join(PROJECT_ROOT, 'usage-meter.js'))}`,
  '      config:',
  `        outputPath: ${yamlQuote(usageFile)}`,
]
if (config === 'lite') {
  rows.push(
    '    - id: catgirl-lite',
    `      name: ${yamlQuote(join(PROJECT_ROOT, 'catgirl-lite.js'))}`,
    '    - id: neko-renderer',
    `      name: ${yamlQuote(join(PROJECT_ROOT, 'neko-renderer.js'))}`,
    '    - id: catgirl-economy',
    `      name: ${yamlQuote(join(PROJECT_ROOT, 'catgirl-economy.js'))}`,
  )
}
writeFileSync(overlayFile, `${rows.join('\n')}\n`)

const startedAt = new Date()
const started = performance.now()
let gitCommit = null
try {
  gitCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  }).trim()
} catch {}
let status = 'passed'
let exitCode = 0
try {
  const output = execFileSync(DSH_BIN, ['--profile', 'headless', '--patch', overlayFile, task], {
    encoding: 'utf8',
    timeout: 300_000,
    env: process.env,
  })
  writeFileSync(outputFile, output)
} catch (error) {
  status = 'failed'
  exitCode = typeof error.status === 'number' ? error.status : 1
  writeFileSync(outputFile, `${String(error.stdout ?? '')}\n[EXIT ${exitCode}] ${String(error.stderr ?? error.message)}`)
}

const metadata = {
  schemaVersion: 1,
  label,
  config,
  task,
  status,
  exitCode,
  startedAt: startedAt.toISOString(),
  durationMs: Math.round(performance.now() - started),
  nodeVersion: process.version,
  pluginVersion: PLUGIN_VERSION,
  gitCommit,
  dshBin: DSH_BIN,
  artifacts: { usageFile, outputFile, overlayFile },
}
writeFileSync(metadataFile, `${JSON.stringify(metadata, null, 2)}\n`)
console.log(JSON.stringify({ status, metadataFile, usageFile, outputFile }))
process.exit(exitCode)
