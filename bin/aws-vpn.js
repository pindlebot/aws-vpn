#!/usr/bin/env node

const yargs = require('yargs')
const path = require('path')
const { HOME } = require('../src/constants')
const fs = require('fs')
const { fork } = require('child_process')
const got = require('got')
const { promisify } = require('util')
const read = promisify(fs.readFile)
const write = promisify(fs.writeFile)
const PID_FILE = path.join(HOME, '.aws-vpn')
const scp = require('../src/scp')

const Haikunator = require('haikunator')

const haikunator = new Haikunator()

const getIp = () => {
  return got('https://api.ipify.org/?format=json', { json: true })
    .then(({ body }) => body.ip)
}

const getPids = async () => {
  let data = await read(PID_FILE, { encoding: 'utf8' })
    .catch(() => null)
  return data ? data.split(/\r?\n/g) : []
}

const listInstances = async () => {
  const AWS = require('aws-sdk')
  const ec2 = new AWS.EC2({ region: process.env.AWS_REGION || 'us-east-1' })
  let { Reservations } = await ec2.describeInstances({
    Filters: [{
      Name: 'tag:Owner',
      Values: ['aws-vpn']
    }]
  }).promise()
  let instances = Reservations.map(({ Instances }) => Instances[0])
  return instances
}

const killAll = async () => {
  let data = await getPids()
  data.forEach(pid => process.kill(parseInt(pid)))
  await write(PID_FILE, '', { encoding: 'utf8' })
}

const format = ip => `ubuntu@${ip}`

const _ = yargs
  .option('region', {
    type: 'string',
    default: process.env.AWS_REGION || 'us-east-1'
  })
  .option('label', {
    type: 'string',
    default: haikunator.haikunate()
  })
  .option('org', {
    type: 'string',
    default: haikunator.haikunate()
  })
  .middleware([(argv) => {
    let { region, label, org } = argv
    process.env.AWS_REGION = region
    process.env.OPEN_VPN_LABEL = label
    process.env.OPEN_VPN_ORG = org
    return {}
  }])
  .command('list', '', () => {}, async (argv) => {
    const instances = await listInstances()
    let table = instances.map(instance => ({
      InstanceId: instance.InstanceId,
      PublicIpAddress: instance.PublicIpAddress || 'NA',
      LaunchTime: instance.LaunchTime,
      Name: instance.Tags.find(({ Key }) => Key === 'Label').Value,
      State: instance.State.Name
    }))
    console.table(table)
  })
  .command('kill', '', () => {}, async () => {
    await killAll()
  })
  .command('load', '', () => {}, async argv => {
    let instances = await listInstances()
    instances = instances.filter(({ State }) => State.Name === 'running')
    await Promise.all(instances.map(({ PublicIpAddress, Tags }) => {
      return scp({
        host: format(PublicIpAddress),
        label: Tags.find(({ Key }) => Key === 'Label').Value
      })
    }))
  })
  .command('connect [label]', '', () => {}, async (argv) => {
    let pids = await getPids()
    if (pids.length) {
      await killAll()
    }
    let beforeIpAddress = await getIp()
    console.log('Your current IP address is ' + beforeIpAddress)
    let instances = await listInstances()
    instances = instances.filter(({ State }) => State.Name === 'running')
    let names = instances.map(instance =>
      instance.Tags.find(({ Key }) => Key === 'Label').Value
    )
    let ovpn = path.join(HOME, `${names[0]}.ovpn`)
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
  })
  .command('remove <instanceId>', '', () => {}, async argv => {
    await require('../src/remove-instance')(argv.instanceId)
  })
  .command('create', '', () => {}, async (argv) => {
    process.env.AWS_REGION = argv.region || process.env.AWS_REGION
    require('../src')()
  }).argv
