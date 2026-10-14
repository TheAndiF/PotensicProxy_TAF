import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const webui = path.resolve(here, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(webui, 'package.json'), 'utf8'))
const version = String(pkg.version)
const publicAssets = path.join(webui, 'public', 'assets')
const expectedName = `taf-pairing-runtime-v${version}.js`
const expectedPath = path.join(publicAssets, expectedName)
const runtimePattern = /^taf-pairing-runtime-v(.+)\.js$/
const indexPath = path.join(webui, 'index.html')
const runtimeTagPattern = /(<script\b[^>]*\bsrc=["']\/assets\/)taf-pairing-runtime-v[^"']+\.js(["'][^>]*><\/script>)/g


if (!fs.existsSync(publicAssets)) {
  console.error(`[pairing-runtime] Missing public assets directory: ${publicAssets}`)
  process.exit(1)
}

// The canonical runtime is tracked independently of generated public assets.
// This repairs clean GitHub checkouts in which the versioned public file was not committed.
const canonicalPath = path.join(here, 'pairing-runtime-source.js')
if (!fs.existsSync(canonicalPath)) {
  console.error(`[pairing-runtime] Missing canonical runtime source: ${canonicalPath}`)
  process.exit(1)
}
const canonical = fs.readFileSync(canonicalPath, 'utf8')
if (!canonical.includes(`const VERSION = '${version}'`) || !canonical.includes(`data-taf-pairing-runtime="${version}"`)) {
  console.error(`[pairing-runtime] Canonical runtime version does not match v${version}; manual version migration required`)
  process.exit(1)
}
if (!fs.existsSync(expectedPath)) {
  fs.writeFileSync(expectedPath, canonical)
  console.log(`[pairing-runtime] Restored generated public asset: ${expectedName}`)
} else if (fs.readFileSync(expectedPath, 'utf8') !== canonical) {
  console.error(`[pairing-runtime] ${expectedName} differs from canonical runtime; refusing to replace functional code silently`)
  process.exit(1)
}

const removed = []
for (const name of fs.readdirSync(publicAssets)) {
  const match = runtimePattern.exec(name)
  if (!match || name === expectedName) continue
  fs.rmSync(path.join(publicAssets, name), { force: true })
  removed.push(name)
}

const runtime = fs.readFileSync(expectedPath, 'utf8')
if (!runtime.includes(`const VERSION = '${version}'`) || !runtime.includes(`data-taf-pairing-runtime="${version}"`)) {
  console.error(`[pairing-runtime] ${expectedName} does not identify itself as v${version}`)
  process.exit(1)
}

// Keep the HTML entrypoint in sync with the versioned runtime source before Vite copies assets.
const indexHtml = fs.readFileSync(indexPath, 'utf8')
let matched = 0
const updatedIndex = indexHtml.replace(runtimeTagPattern, (_all, prefix, suffix) => {
  matched++
  return `${prefix}${expectedName}${suffix}`
})
if (matched !== 1) {
  console.error(`[pairing-runtime] Expected exactly one versioned runtime script in webui/index.html, found ${matched}`)
  process.exit(1)
}
if (updatedIndex !== indexHtml) {
  fs.writeFileSync(indexPath, updatedIndex)
  console.log(`[pairing-runtime] Synchronized index.html -> ${expectedName}`)
}

if (removed.length) {
  console.log(`[pairing-runtime] Removed stale runtime source(s): ${removed.join(', ')}`)
}
console.log(`[pairing-runtime] OK: only ${expectedName} will be copied into the embedded WebUI build`)
