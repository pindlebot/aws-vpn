const createInstance = require('./create-instance')
const createSecurityGroup = require('./create-security-group')
const addInboundRule = require('./add-inbound-rule')
const isRunning = require('./is-running')
const { INBOUND_RULES } = require('./constants')
const { sleep, hasPrivateKey } = require('./util')
const { gauge, createProgress } = require('./gauge')
const scp = require('./scp')
const ssh = require('./ssh')
const writePrivateSSHKey = require('./write-private-ssh-key')
const associateElasticIp = require('./associate-elastic-ip')
let progress = createProgress('create', 100)
const AWS = require('aws-sdk')
const ec2 = new AWS.EC2({ region: process.env.AWS_REGION })

async function run () {
  await writePrivateSSHKey(progress)
  progress.increment('Creating security group')
  const { GroupId } = await createSecurityGroup()
  progress.increment('Adding inbound rules')
  await addInboundRule(GroupId, INBOUND_RULES)
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

  await associateElasticIp({ AllocationId, InstanceId })
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
