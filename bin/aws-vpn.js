#!/usr/bin/env node

const yargs = require('yargs')
const scp = require('../src/scp')
const { killAll } = require('../src/util')
const connect = require('../src/connect')
const Haikunator = require('haikunator')
const listInstances = require('../src/list-instances')
const haikunator = new Haikunator()

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
  .command('connect [name]', '', () => {}, async (argv) => {
    await connect(argv)
  })
  .command('remove <instanceId>', '', () => {}, async argv => {
    await require('../src/remove-instance')(argv.instanceId)
  })
  .command('create', '', () => {}, async (argv) => {
    process.env.AWS_REGION = argv.region || process.env.AWS_REGION
    require('../src')()
  }).argv
