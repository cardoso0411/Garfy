import '../Backend/src/env.js'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.PORT || 3001)
const healthUrl = `http://127.0.0.1:${port}/api/health`
const children = []

const healthy = async () => {
  try { return (await fetch(healthUrl, { signal: AbortSignal.timeout(1000) })).ok }
  catch { return false }
}

const stop = () => { for (const child of children) child.kill() }
process.on('SIGINT', () => { stop(); process.exit(0) })
process.on('SIGTERM', () => { stop(); process.exit(0) })
process.on('exit', stop)

if (!await healthy()) {
  console.log('Iniciando API Garfy...')
  const backend = spawn(process.execPath, ['--watch', 'src/server.js'], {
    cwd: resolve(root, 'Backend'), stdio: 'inherit', env: process.env,
  })
  children.push(backend)
  for (let attempt = 0; attempt < 30 && !await healthy(); attempt++) {
    if (backend.exitCode !== null) break
    await new Promise(resolveDelay => setTimeout(resolveDelay, 500))
  }
  if (!await healthy()) {
    stop()
    console.error('A API não ficou pronta. Confira a conexão MySQL e o arquivo Backend/.env.backend.')
    process.exit(1)
  }
} else {
  console.log(`API Garfy já está pronta na porta ${port}.`)
}

console.log('Iniciando frontend...')
const frontend = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], {
  cwd: resolve(root, 'Frontend'), stdio: 'inherit', env: { ...process.env, API_PORT: String(port) },
})
children.push(frontend)
frontend.on('exit', code => { stop(); process.exit(code ?? 0) })
