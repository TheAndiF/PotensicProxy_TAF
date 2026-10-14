import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const webui = path.resolve(here, '..')
const project = path.resolve(webui, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(webui, 'package.json'), 'utf8'))
const version = String(pkg.version)
const embedded = path.join(project, 'app', 'src', 'main', 'assets', 'web')
const indexPath = path.join(embedded, 'index.html')
const runtimeName = `taf-pairing-runtime-v${version}.js`
const runtimePath = path.join(embedded, 'assets', runtimeName)
const publicAssets = path.join(webui, 'public', 'assets')
const publicRuntimePath = path.join(publicAssets, runtimeName)
const sourceIndexPath = path.join(webui, 'index.html')


function fail(message) {
  console.error(`[embedded-version] ${message}`)
  process.exitCode = 1
}

const sourceIndex = fs.readFileSync(sourceIndexPath, 'utf8')
if (!sourceIndex.includes(`/assets/${runtimeName}`)) fail(`Source index.html does not reference ${runtimeName}`)
if (!fs.existsSync(indexPath)) {
  fail(`Missing embedded index: ${indexPath}`)
} else {
  const index = fs.readFileSync(indexPath, 'utf8')
  if (!index.includes(runtimeName)) fail(`index.html does not reference ${runtimeName}`)
}

if (!fs.existsSync(runtimePath)) fail(`Missing runtime asset: ${runtimePath}`)
if (!fs.existsSync(publicRuntimePath)) fail(`Missing runtime source: ${publicRuntimePath}`)

if (fs.existsSync(publicAssets)) {
  for (const name of fs.readdirSync(publicAssets)) {
    const match = /^taf-pairing-runtime-v(.+)\.js$/.exec(name)
    if (match && match[1] !== version) fail(`Stale public pairing runtime found: ${name}`)
  }
}

const assetsDir = path.join(embedded, 'assets')
if (fs.existsSync(assetsDir)) {
  for (const name of fs.readdirSync(assetsDir)) {
    const match = /^taf-pairing-runtime-v(.+)\.js$/.exec(name)
    if (match && match[1] !== version) fail(`Stale pairing runtime found: ${name}`)
  }
}

const gradle = fs.readFileSync(path.join(project, 'app', 'build.gradle.kts'), 'utf8')
// Android may use a literal versionName or the shared webuiVersion variable.
// Validate the variable's Gradle definition instead of treating it as "unknown".
const versionAssignment = /versionName\s*=\s*("[^"]+"|[A-Za-z_][A-Za-z0-9_]*)/.exec(gradle)?.[1]
let backendVersion
if (versionAssignment?.startsWith('"')) {
  backendVersion = versionAssignment.slice(1, -1)
} else if (versionAssignment === 'webuiVersion') {
  const sharedSource = /val\s+webuiVersion\s*=\s*\(JsonSlurper\(\)\.parse\(rootProject\.file\("webui\/package\.json"\)\)\s+as\s+Map<\*,\s*\*>\)\["version"\]\.toString\(\)/
  if (sharedSource.test(gradle)) backendVersion = version
}
if (backendVersion !== version) fail(`Frontend ${version} != Android backend ${backendVersion ?? 'unknown'} (versionName: ${versionAssignment ?? 'missing'})`)

let jsContainsVersion = false
function walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(file)
    else if (/\.(?:js|mjs)$/.test(entry.name)) {
      const text = fs.readFileSync(file, 'utf8')
      if (text.includes(version)) jsContainsVersion = true
    }
  }
}
walk(embedded)
if (!jsContainsVersion) fail(`Embedded JavaScript does not contain frontend version ${version}`)


// Release gate: the actual Android-embedded JavaScript must contain the new
// System > App / Drohne / Web navigation and its primary destinations.
// This prevents publishing a version-bumped APK with the old System UI.
const bundleNames = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir).filter(n => /^index-.*\.js$/.test(n)) : []
const entryJs = bundleNames.map(n => fs.readFileSync(path.join(assetsDir, n), 'utf8')).join('\n')
const requiredNavigation = ['Kommunikationsprotokoll', 'App-Updates', 'Remote / Relay', 'Sprache']
for (const label of requiredNavigation) {
  if (!entryJs.includes(label)) fail(`Embedded WebUI has no System navigation label: ${label}; rebuild WebUI from current sources`)
}
// The group selection names must be embedded in the compiled System navigation.
if (!entryJs.includes('Systembereich') || !entryJs.includes('Systemfunktion')) {
  fail('Embedded WebUI does not contain App / Drohne / Web navigation controls')
}

if (!process.exitCode) console.log(`[embedded-version] OK: frontend/backend/runtime v${version}`)
