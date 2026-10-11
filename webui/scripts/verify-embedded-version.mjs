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

function fail(message) {
  console.error(`[embedded-version] ${message}`)
  process.exitCode = 1
}

if (!fs.existsSync(indexPath)) {
  fail(`Missing embedded index: ${indexPath}`)
} else {
  const index = fs.readFileSync(indexPath, 'utf8')
  if (!index.includes(runtimeName)) fail(`index.html does not reference ${runtimeName}`)
}

if (!fs.existsSync(runtimePath)) fail(`Missing runtime asset: ${runtimePath}`)

const assetsDir = path.join(embedded, 'assets')
if (fs.existsSync(assetsDir)) {
  for (const name of fs.readdirSync(assetsDir)) {
    const match = /^taf-pairing-runtime-v(.+)\.js$/.exec(name)
    if (match && match[1] !== version) fail(`Stale pairing runtime found: ${name}`)
  }
}

const gradle = fs.readFileSync(path.join(project, 'app', 'build.gradle.kts'), 'utf8')
const backendVersion = /versionName\s*=\s*"([^"]+)"/.exec(gradle)?.[1]
if (backendVersion !== version) fail(`Frontend ${version} != Android backend ${backendVersion ?? 'unknown'}`)

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

if (!process.exitCode) console.log(`[embedded-version] OK: frontend/backend/runtime v${version}`)
