const { hasPrivateKey } = require('./util')
const createKeyPair = require('./create-key-pair')
const { promisify } = require('util')
const fs = require('fs')
const write = promisify(fs.writeFile)
const chmod = promisify(fs.chmod)
const { PRIVATE_KEY_PATH } = require('./util')

module.exports = async (progress) => {
  const hasKey = await hasPrivateKey()
  if (!hasKey) {
    progress.increment('Creating key pair')
    const { KeyMaterial } = await createKeyPair()
    await write(PRIVATE_KEY_PATH, KeyMaterial, { encoding: 'utf8' })
    await chmod(PRIVATE_KEY_PATH, '0600').catch(console.error.bind(console))
  }
}
