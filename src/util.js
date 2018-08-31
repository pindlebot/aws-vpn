const { randomBytes } = require('crypto')
const { promisify } = require('util')
const fs = require('fs')
const access = promisify(fs.access)
const read = promisify(fs.readFile)
const write = promisify(fs.writeFile)
const { PRIVATE_KEY_PATH, PID_FILE } = require('./constants')
const got = require('got')

const genId = () => randomBytes(3).toString('hex')

const sleep = (interval = 3) => new Promise((resolve, reject) => setTimeout(resolve, interval * 1000))

const hasPrivateKey = () => access(PRIVATE_KEY_PATH)
  .then(() => true)
  .catch(() => false)

const getLocation = () => {
  return got('http://ip-api.com/json', { json: true }).then(({ body }) => body)
}

const getIp = () => {
  return got('https://api.ipify.org/?format=json', { json: true })
    .then(({ body }) => body.ip)
}

const getPids = async () => {
  let data = await read(PID_FILE, { encoding: 'utf8' })
    .catch(() => null)
  return data ? data.split(/\r?\n/g) : []
}

const killAll = async () => {
  let data = await getPids()
  data.forEach(pid => {
    try {
      process.kill(parseInt(pid))
    } catch (err) {}
  })
  await write(PID_FILE, '', { encoding: 'utf8' })
}

module.exports = {
  sleep,
  genId,
  hasPrivateKey,
  getLocation,
  getPids,
  getIp,
  killAll
}
