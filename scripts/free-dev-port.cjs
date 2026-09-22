const { execSync } = require('node:child_process')

const PORT = Number(process.env.PORT || 3000)

function listeningPids(port) {
  let stdout = ''
  try {
    stdout = execSync('netstat -ano', { encoding: 'utf8' })
  } catch {
    return []
  }
  const pids = new Set()
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.includes('LISTENING')) {
      continue
    }
    if (!line.includes(`:${port} `) && !line.endsWith(`:${port}`)) {
      continue
    }
    const pid = line.trim().split(/\s+/).pop()
    if (pid && /^\d+$/.test(pid) && pid !== '0') {
      pids.add(pid)
    }
  }
  return [...pids]
}

for (const pid of listeningPids(PORT)) {
  try {
    execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' })
  } catch {
    // Process may already have exited.
  }
}
