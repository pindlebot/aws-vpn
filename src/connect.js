const path = require('path')
const { promisify } = require('util')
const fs = require('fs')
const write = promisify(fs.writeFile)
const access = promisify(fs.access)
const { fork } = require('child_process')
const { kill, getIp } = require('./util')
const listInstances = require('./list-instances')
const { HOME, PID_FILE } = require('./constants')
const scp = require('./scp')
const AWS = require('aws-sdk')
const IP_REGEX = /(\d{1,3}\.){3}\d{1,3}/
const config = require('./config')

const getOpenVpnName = async ({ currentIp, name }) => {
  let target
  if (name) {
    if (!IP_REGEX.test(name)) {
      return name
    } else {
      target = name
    }
  }
  let instances = process.env.NO_CACHE
    ? await listInstances()
    : await config.get().then(({ instances }) => instances.map(inst => ({
      PublicIpAddress: inst.ip,
      InstanceId: inst.instanceId,
      Label: inst.label
    })))
  instances = instances
    .filter(({ PublicIpAddress }) =>
      PublicIpAddress !== currentIp
    )
  if (target) {
    let instance = instances.find(({ PublicIpAddress }) => PublicIpAddress === target)
    return instance.Label
  }
  let names = instances.map(instance => instance.Label)

  return names[Math.floor(Math.random() * instances.length)]
}

const getInstanceByLabel = async ({ label }) => {
  let cache = await config.get()
  let inst = cache.instances.find(intance => intance.label === label)
  return {
    InstanceId: inst.instanceId,
    PublicIpAddress: inst.ip,
    Label: inst.label
  }
  // const ec2 = new AWS.EC2({ region: process.env.AWS_REGION })
  // let { Reservations } = await ec2.describeInstances({
  //  Filters: [{
  //    Name: 'tag:Owner',
  //    Values: ['aws-vpn']
  //  }, {
  //    Name: 'tag:Label',
  //    Values: [label]
  //  }]
  // }).promise()
  // let instances = Reservations.map(({ Instances }) => Instances[0])
  // return instances[0]
}

module.exports = async (params = {}) => {
  let currentIp = await getIp()
  await kill()
  console.log('Your current IP address is ' + currentIp)
  let name = await getOpenVpnName({ ...params, currentIp })
  let ovpn = path.join(HOME, `${name}.ovpn`)
  try {
    await access(ovpn)
  } catch (err) {
    let instance = await getInstanceByLabel({ label: name })
    await scp({ host: `ubuntu@${instance.PublicIpAddress}`, label: name })
  }
  let subprocess = fork(path.join(__dirname, 'spawn.js'), [ovpn], {
    uid: 0
  })
  subprocess.on('message', async message => {
    let afterIpAddress = await getIp()
    console.log(`Started process with pid ${message.pid}. Your public IP is now ${afterIpAddress}`)
    subprocess.unref()
    await config.set({ pid: message.pid })
  })
}
