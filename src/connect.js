const path = require('path')
const { promisify } = require('util')
const fs = require('fs')
const write = promisify(fs.writeFile)
const access = promisify(fs.access)
const { fork } = require('child_process')
const { getPids, killAll, getIp } = require('./util')
const listInstances = require('./list-instances')
const { HOME, PID_FILE } = require('./constants')
const describeInstance = require('./describe-instance')
const scp = require('./scp')
const AWS = require('aws-sdk')

const getOpenVpnName = async () => {
  let instances = await listInstances()
  instances = instances.filter(({ State }) => State.Name === 'running')
  let names = instances.map(instance =>
    instance.Tags.find(({ Key }) => Key === 'Label').Value
  )
  return names[Math.floor(Math.random() * instances.length)]
}

const getInstance = async ({ label }) => {
  const ec2 = new AWS.EC2({ region: process.env.AWS_REGION })
  let { Reservations } = await ec2.describeInstances({
    Filters: [{
      Name: 'tag:Owner',
      Values: ['aws-vpn']
    }, {
      Name: 'tag:Label',
      Values: [label]
    }]
  }).promise()
  let instances = Reservations.map(({ Instances }) => Instances[0])
  return instances[0]
}

module.exports = async (argv) => {
  let pids = await getPids()
  if (pids.length) {
    await killAll()
  }
  let beforeIpAddress = await getIp()
  console.log('Your current IP address is ' + beforeIpAddress)
  let name = argv.name ? argv.name : await getOpenVpnName()
  let ovpn = path.join(HOME, `${name}.ovpn`)
  try {
    await access(ovpn)
  } catch (err) {
    let instance = await getInstance({ label: name })
    await scp({ host: `ubuntu@${instance.PublicIpAddress}`, label: name })
  }
  let subprocess = fork(path.join(__dirname, 'spawn.js'), [ovpn], {
    uid: 0
  })
  subprocess.on('message', async message => {
    let afterIpAddress = await getIp()
    console.log(`Started process with pid ${message.pid}. Your public IP is now ${afterIpAddress}`)
    subprocess.unref()
    pids.push(message.pid)
    await write(PID_FILE, pids.join('\n'), { encoding: 'utf8' })
  })
}
