// Minimal home server: serves the built app from dist/ and keeps the shared
// state in data/state.json. No dependencies beyond Node.js (18+).
//
//   PORT=9999 HOST=0.0.0.0 DATA_DIR=./data node server/server.mjs

import { createServer } from 'node:http'
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const DIST = resolve(process.env.DIST_DIR ?? join(root, 'dist'))
const DATA = resolve(process.env.DATA_DIR ?? join(root, 'data'))
const PORT = Number(process.env.PORT ?? 9999)
const HOST = process.env.HOST ?? '0.0.0.0'
const STATE = join(DATA, 'state.json')
const BACKUPS = join(DATA, 'backups')
const KEEP_BACKUPS = 50
const MAX_BODY = 5 * 1024 * 1024

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

async function loadState() {
  try {
    return JSON.parse(await readFile(STATE, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return { rev: 0, state: null }
    throw e
  }
}

async function saveState(doc) {
  await mkdir(BACKUPS, { recursive: true })
  // Keep the previous version before replacing it.
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    await rename(STATE, join(BACKUPS, `state-${stamp}.json`))
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  const tmp = `${STATE}.tmp`
  await writeFile(tmp, JSON.stringify(doc))
  await rename(tmp, STATE)
  const old = (await readdir(BACKUPS)).filter((f) => f.startsWith('state-')).sort()
  for (const f of old.slice(0, Math.max(0, old.length - KEEP_BACKUPS))) await unlink(join(BACKUPS, f))
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))
}

function readBody(req) {
  return new Promise((ok, fail) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        fail(Object.assign(new Error('too large'), { status: 413 }))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')))
    req.on('error', fail)
  })
}

// Serialise writes so two saves can't interleave.
let queue = Promise.resolve()

async function handleApi(req, res) {
  if (req.method === 'GET') return send(res, 200, await loadState())
  if (req.method !== 'PUT') return send(res, 405, { error: 'method not allowed' })

  let body
  try {
    body = JSON.parse(await readBody(req))
  } catch (e) {
    return send(res, e.status ?? 400, { error: 'invalid body' })
  }
  if (typeof body?.rev !== 'number' || typeof body.state !== 'object' || !Array.isArray(body.state?.buoni)) {
    return send(res, 400, { error: 'expected { rev, state }' })
  }

  const result = (queue = queue.then(async () => {
    const current = await loadState()
    if (body.rev !== current.rev) return { status: 409, body: { error: 'conflict', rev: current.rev } }
    const next = { rev: current.rev + 1, savedAt: new Date().toISOString(), state: body.state }
    await saveState(next)
    return { status: 200, body: { rev: next.rev } }
  }))
  const { status, body: out } = await result
  send(res, status, out)
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x')
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
  let file = resolve(DIST, path)
  if (file !== DIST && !file.startsWith(DIST + sep)) return send(res, 403, 'forbidden', 'text/plain')
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
  } catch {
    file = join(DIST, 'index.html') // single-page app fallback
    path = 'index.html'
  }
  try {
    const data = await readFile(file)
    const immutable = path.startsWith('assets/')
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    res.end(data)
  } catch {
    send(res, 404, 'not found — run `npm run build` first', 'text/plain')
  }
}

createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/state')) await handleApi(req, res)
    else if (req.method === 'GET' || req.method === 'HEAD') await serveStatic(req, res)
    else send(res, 405, { error: 'method not allowed' })
  } catch (e) {
    console.error(e)
    send(res, 500, { error: 'server error' })
  }
}).listen(PORT, HOST, () => {
  console.log(`Buoni postali on http://${HOST}:${PORT}  (data: ${DATA})`)
})
