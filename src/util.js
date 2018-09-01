const { randomBytes } = require('crypto')
const { promisify } = require('util')
const fs = require('fs')
const access = promisify(fs.access)
const path = require('path')
const { HOME, KEY_NAME } = require('./constants')
const got = require('got')
const { exec } = require('child_process')

const getPrivateKeyPath = () => {
  return path.join(HOME, '.ssh', `${KEY_NAME}.${process.env.AWS_REGION}.key`)
}

const genId = () => randomBytes(3).toString('hex')

const sleep = (interval = 3) => new Promise((resolve, reject) => setTimeout(resolve, interval * 1000))

const hasPrivateKey = () => {
  return access(getPrivateKeyPath())
    .then(() => true)
    .catch(() => false)
}

const getLocation = () => {
  return got('http://ip-api.com/json', { json: true }).then(({ body }) => body)
}

const getIp = () => {
  return got('https://api.ipify.org/?format=json', { json: true })
    .then(({ body }) => body.ip)
}

const kill = async () => {
  const grep = `ps -ef | grep "[o]penvpn --config" | awk 'FNR == 1 {print $2}'`
  const pid = await new Promise((resolve, reject) =>
    exec(grep, { uid: 0 }, (err, stderr, stdout) => {
      if (err) reject(err)
      else resolve(stdout || stderr)
    })
  )
  if (pid) {
    await await new Promise((resolve, reject) =>
      exec(`kill -9 ${pid}`, { uid: 0 }, (err, stderr, stdout) => {
        if (err) reject(err)
        else resolve(stdout || stderr)
      })
    )
  }
}

module.exports = {
  sleep,
  genId,
  hasPrivateKey,
  getLocation,
  getIp,
  kill,
  getPrivateKeyPath
}
