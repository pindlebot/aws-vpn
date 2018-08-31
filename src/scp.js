const { spawn } = require('child_process')
const { PRIVATE_KEY_PATH, HOME } = require('./constants')
const path = require('path')
const { promisify } = require('util')
const fs = require('fs')
const read = promisify(fs.readFile)
const write = promisify(fs.writeFile)

const removeKnownHostIfNeeded = async (host) => {
  let raw = await read(path.join(HOME, '.ssh/known_hosts'), { encoding: 'utf8' })
  let knownHosts = raw.split(/\r?\n/g)
  let ipAddress = host.split('@')[0]
  let index = 0
  while (index < knownHosts.length) {
    let knownHost = knownHosts[index]
    if (knownHost.startsWith(ipAddress)) {
      knownHosts.splice(index, 1)
      await write(path.join(HOME, '.ssh/known_hosts'), knownHosts.join('\n'), { encoding: 'utf8' })
      break
    }
    index++
  }
}

module.exports = async ({ host, label }) => {
  await removeKnownHostIfNeeded(host)
  label = label || process.env.OPEN_VPN_LABEL
  let args = [`${host}:/home/ubuntu/${label}.ovpn`, path.join(HOME, `${label}.ovpn`)]
  args = ['-i', PRIVATE_KEY_PATH, '-o', '"StrictHostKeyChecking no"'].concat(args)
  let child = spawn('scp', args, { shell: true })
  let resolvePromise
  let rejectPromise
  let promise = new Promise((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  child.stdout.on('data', data => {
    process.stdout.write(`[${label}] ${data}`)
  })
  child.stderr.on('data', data => {
    process.stdout.write(`[${label}] ${data}`)
  })
  child.on('error', rejectPromise)
  child.on('close', resolvePromise)
  return promise
}
