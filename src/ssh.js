const { spawn } = require('child_process')
const { getPrivateKeyPath } = require('./util')
const { gauge } = require('./gauge')

module.exports = ({ host }) => {
  const PRIVATE_KEY_PATH = getPrivateKeyPath()
  const label = process.env.OPEN_VPN_LABEL
  let args = [
    '-i',
    PRIVATE_KEY_PATH,
    '-o',
    '"StrictHostKeyChecking no"',
    host,
    '"tail -f /tmp/part-001.log"'
  ]
  let child = spawn('ssh', args, { shell: true })
  let resolvePromise
  let rejectPromise
  let promise = new Promise((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = (err) => {
      process.kill(child.pid)
      reject(err || new Error('not ready'))
    }
  })
  child.stdout.once('data', async () => {
    await gauge().disable()
  })
  child.stdout.on('data', data => {
    if (/Data Base Updated/.test(data.toString())) {
      process.kill(child.pid)
      resolvePromise()
    }
    process.stdout.write(`[${label}] ${data}`)
  })
  child.stderr.on('data', data => {
    if (/cannot open/.test(data.toString())) {
      process.kill(child.pid)
      rejectPromise()
    }
  })
  child.on('error', rejectPromise)
  child.on('close', resolvePromise)

  return promise
}

