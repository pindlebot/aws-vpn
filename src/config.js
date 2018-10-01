const { HOME } = require('./constants')
const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const read = promisify(fs.readFile)
const write = promisify(fs.writeFile)
const merge = require('deepmerge')

const DEFAULT_CONFIG = '{"regions":[],"pid":null,"instances":[]}'

const arrayMerge = (source, dest) => {
  if (
    source.length &&
    dest.length &&
    typeof source[0] === 'object' &&
    typeof dest[0] === 'object'
  ) {
    return dest
  }
  return [...new Set([...source, ...dest])]
}

const preload = (pathname) => {
  let json
  try {
    json = fs.readFileSync(pathname, { encoding: 'utf8' })
  } catch (err) {
    json = DEFAULT_CONFIG
  }
  return JSON.parse(json || DEFAULT_CONFIG)
}

class Config {
  constructor () {
    this.path = path.join(HOME, '.aws-vpn')
    this.cache = preload(this.path)
  }

  get () {
    return read(this.path, { encoding: 'utf8' })
      .catch(() => DEFAULT_CONFIG)
      .then(config => {
        this.cache = JSON.parse(config)
        return this.cache
      })
  }

  set (value = {}) {
    let data = merge(this.cache, value, { arrayMerge })
    data.regions = [...new Set(data.regions || [])]
    return write(
      this.path,
      JSON.stringify(data),
      { encoding: 'utf8' }
    ).then(() => {
      this.cache = data
      return this
    })
  }
}

module.exports = new Config()
