const { promisify } = require('util')
const path = require('path')
const fs = require('fs')
const write = promisify(fs.writeFile)
const chmod = promisify(fs.chmod)
const read = promisify(fs.readFile)
const createInstance = require('./create-instance')
const createKeyPair = require('./create-key-pair')
const createSecurityGroup = require('./create-security-group')
const addInboundRule = require('./add-inbound-rule')
const isRunning = require('./is-running')
const describeInstance = require('./describe-instance')
const { PRIVATE_KEY_PATH, HOME } = require('./constants')
const { sleep, pathExists } = require('./util')
const { gauge, createProgress } = require('./gauge')
const scp = require('./scp')
const ssh = require('./ssh')

let progress = createProgress('create', 100)
const AWS = require('aws-sdk')
const ec2 = new AWS.EC2({ region: process.env.AWS_REGION })

async function postDeploy ({ AllocationId, InstanceId }) {
  await ec2.associateAddress({
    AllocationId: AllocationId,
    InstanceId: InstanceId
  })
    .promise()
    .catch(console.log.bind(console))
  await ec2.modifyInstanceAttribute({
    InstanceId,
    SourceDestCheck: {
      Value: false
    }
  }).promise()
    .catch(console.log.bind(console))
}

async function run () {
  const hasKey = await pathExists()
  if (!hasKey) {
    progress.increment('Creating key pair')
    const { KeyMaterial } = await createKeyPair()
    await write(PRIVATE_KEY_PATH, KeyMaterial, { encoding: 'utf8' })
    await chmod(PRIVATE_KEY_PATH, '0600').catch(console.error.bind(console))
  }
  progress.increment('Creating security group')
  const { GroupId } = await createSecurityGroup()
  progress.increment('Adding inbound rules')
  await addInboundRule(GroupId, [{
    Port: 1194,
    IpProtocol: 'udp'
  }, {
    Port: 22,
    Description: 'SSH'
  }, {
    Port: 943
  }, {
    Port: 443
  }])
  progress.increment('Creating instance')
  let { Addresses } = await ec2.describeAddresses().promise()
  let Address = Addresses.find(addr => !addr.AssociationId)
  if (!Address) {
    Address = await ec2.allocateAddress({}).promise()
  }
  let { AllocationId, PublicIp } = Address
  const { InstanceId } = await createInstance({ GroupId, PublicIp, AllocationId })
  let running = false
  while (!running) {
    await sleep()
    progress.increment('Checking if instance is running')
    running = await isRunning({ InstanceId })
  }

  await postDeploy({ AllocationId, InstanceId })
  await sleep(15)

  const host = `ubuntu@${PublicIp}`
  await gauge().disable()

  const connect = async () => {
    await ssh({ host })
      .then(() => {
        scp({ host }).catch(err => {
          console.log(err)
        })
      })
      .catch(() => {
        setTimeout(() => {
          return connect()
        }, 1000 * 15)
      })
  }

  await connect()
}

module.exports = run
