const { randomBytes } = require('crypto')
const { promisify } = require('util')
const fs = require('fs')
const access = promisify(fs.access)
const { PRIVATE_KEY_PATH } = require('./constants')

const genId = () => randomBytes(3).toString('hex')

const sleep = (interval = 3) => new Promise((resolve, reject) => setTimeout(resolve, interval * 1000))

const pathExists = () => access(PRIVATE_KEY_PATH)
  .then(() => true)
  .catch(() => false)

module.exports = {
  sleep,
  genId,
  pathExists
}
