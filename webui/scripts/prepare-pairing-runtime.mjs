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

if (!fs.existsSync(publicAssets)) {
  console.error(`[pairing-runtime] Missing public assets directory: ${publicAssets}`)
  process.exit(1)
}

if (!fs.existsSync(expectedPath)) {
  console.error(`[pairing-runtime] Missing current runtime source: ${expectedName}`)
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

if (removed.length) {
  console.log(`[pairing-runtime] Removed stale runtime source(s): ${removed.join(', ')}`)
}
console.log(`[pairing-runtime] OK: only ${expectedName} will be copied into the embedded WebUI build`)
