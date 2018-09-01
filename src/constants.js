const path = require('path')

const HOME = process.platform === 'win32'
  ? process.env.USERPROFILE
  : process.env.HOME

const KEY_NAME = 'open-vpn'
const PREFIX = 'aws-vpn'
const PID_FILE = path.join(HOME, '.aws-vpn')

const INBOUND_RULES = [{
  Port: 1194,
  IpProtocol: 'udp'
}, {
  Port: 22,
  Description: 'SSH'
}, {
  Port: 943
}, {
  Port: 443
}]

module.exports = {
  HOME,
  KEY_NAME,
  PREFIX,
  INBOUND_RULES,
  PID_FILE
}
