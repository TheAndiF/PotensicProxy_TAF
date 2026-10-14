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


// Release gate: stable marker emitted by the real System navigation element.
// Avoid checking arbitrary German labels in minified bundles: compilers can
// split/transform those strings. Inspect the source structure as well as the
// emitted marker, so the check cannot pass merely because a marker was copied.
const systemSourcePath = path.join(webui, 'src', 'components', 'debug', 'DebugConsoleView.vue')
const systemSource = fs.readFileSync(systemSourcePath, 'utf8')
const navigationMarker = 'app-drone-web-v1'
if (!systemSource.includes(`data-taf-system-navigation="${navigationMarker}"`)) {
  fail('System navigation marker missing from DebugConsoleView.vue')
}
for (const group of ['app', 'drone', 'web']) {
  if (!new RegExp(`value="${group}"`).test(systemSource)) {
    fail(`System navigation is missing group ${group} in the source`)
  }
}
for (const component of ['LanguagePanel', 'AppUpdateSettings', 'DroneProfilePanel', 'RemoteRelayPanel', 'LogConsole']) {
  if (!systemSource.includes(component)) fail(`System feature component missing: ${component}`)
}
const bundleNames = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir).filter(n => /^index-.*\.js$/.test(n)) : []
const entryJs = bundleNames.map(n => fs.readFileSync(path.join(assetsDir, n), 'utf8')).join('\n')
if (!bundleNames.length || !entryJs.includes(navigationMarker)) {
  fail('Embedded WebUI does not contain the compiled System navigation marker; rebuild from current sources')
}

if (!process.exitCode) console.log(`[embedded-version] OK: frontend/backend/runtime v${version}; System navigation marker verified`)
