#!/usr/bin/env node
// Runs a command with ELECTRON_RUN_AS_NODE removed from the environment.
// Shells launched from VS Code export that variable, which makes every Electron binary
// (electron, electron-vite dev/preview, Playwright's _electron, electron-builder helpers)
// start as plain Node. Usage: node scripts/with-electron-env.mjs <command> [args...]
import { spawn } from 'node:child_process'

const [command, ...args] = process.argv.slice(2)
if (!command) {
  console.error('usage: node scripts/with-electron-env.mjs <command> [args...]')
  process.exit(2)
}

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(command, args, { stdio: 'inherit', env, shell: process.platform === 'win32' })

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => child.kill(signal))
}

child.on('error', (error) => {
  console.error(`with-electron-env: failed to start "${command}": ${error.message}`)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
