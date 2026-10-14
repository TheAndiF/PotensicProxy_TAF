import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const web = path.join(root, 'webui')
const pkg = JSON.parse(fs.readFileSync(path.join(web, 'package.json'), 'utf8'))
const lock = JSON.parse(fs.readFileSync(path.join(web, 'package-lock.json'), 'utf8'))
const errors = []
if (pkg.version !== lock.version || pkg.version !== lock.packages?.['']?.version) errors.push('package-lock.json version differs from package.json')
const runtime = path.join(web, 'public', 'assets', `taf-pairing-runtime-v${pkg.version}.js`)
if (!fs.existsSync(runtime)) errors.push(`Missing pairing runtime ${path.basename(runtime)}`)
const source = fs.readFileSync(path.join(web, 'index.html'), 'utf8')
if (!source.includes(`taf-pairing-runtime-v${pkg.version}.js`)) errors.push('index.html references wrong pairing runtime')
if (!fs.existsSync(path.join(root, 'app', 'src', 'main', 'java', 'com', 'potensic', 'proxy'))) errors.push('Android source directory missing')
if (errors.length) {for (const e of errors) console.error(`[source-check] ERROR: ${e}`); process.exit(1)}
console.log(`[source-check] OK: v${pkg.version}, lockfile and runtime sources`)
