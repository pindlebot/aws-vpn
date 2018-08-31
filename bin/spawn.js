const { spawn } = require('child_process')

let ovpn = process.argv.slice(2)[0]
let subprocess = spawn('openvpn', ['--config', ovpn, '--redirect-gateway', 'def1'], {
  shell: true,
  uid: 0
})
subprocess.stdout.on('data', async data => {
  let str = data.toString()
  if (/Initialization Sequence Completed/.test(str)) {
    process.send({ message: 'ready', pid: subprocess.pid })
    setTimeout(() => process.disconnect(), 0)
  }
})
subprocess.stderr.on('data', data => {})
