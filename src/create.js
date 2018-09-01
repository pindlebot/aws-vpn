const createInstance = require('./create-instance')
const createSecurityGroup = require('./create-security-group')
const addInboundRule = require('./add-inbound-rule')
const isRunning = require('./is-running')
const { INBOUND_RULES } = require('./constants')
const { sleep } = require('./util')
const { gauge, createProgress } = require('./gauge')
const scp = require('./scp')
const ssh = require('./ssh')
const writePrivateSSHKey = require('./write-private-ssh-key')
const associateElasticIp = require('./associate-elastic-ip')
let progress = createProgress('create', 100)
const AWS = require('aws-sdk')
const config = require('./config')

const getAddress = async () => {
  const ec2 = new AWS.EC2({ region: process.env.AWS_REGION })
  let { Addresses } = await ec2.describeAddresses().promise()

  if (Addresses.length > 4) {
    let { Regions } = await ec2.describeRegions().promise()
    let regions = Regions.map(({ RegionName }) => RegionName)
    regions = regions.filter(region => region !== process.env.AWS_REGION)
    let region = regions[Math.floor(Math.random() * regions.length)]

    process.env.AWS_REGION = region
    await config.set({ regions: [region] })
    return getAddress()
  }

  Addresses = Addresses.filter(addr => !addr.AssociationId)

  if (!Addresses.length) {
    return ec2.allocateAddress({}).promise()
  }

  return Addresses[0]
}

async function create () {
  let data = await config.get()
  if (!data.regions.includes(process.env.AWS_REGION)) {
    await config.set({ regions: [process.env.AWS_REGION] })
  }
  let Address = await getAddress()
  const { PublicIp, AllocationId } = Address

  await writePrivateSSHKey(progress)

  progress.increment('Creating security group')
  const { GroupId } = await createSecurityGroup()

  progress.increment('Adding inbound rules')
  await addInboundRule(GroupId, INBOUND_RULES)

  progress.increment('Creating instance')
  const { InstanceId } = await createInstance({ GroupId, PublicIp, AllocationId })
  await config.set({
    instances: data.instances.concat([{
      instanceId: InstanceId,
      region: process.env.AWS_REGION,
      ip: PublicIp,
      label: process.env.OPEN_VPN_LABEL
    }])
  })

  let running = false
  while (!running) {
    await sleep()
    progress.increment('Checking if instance is running')
    running = await isRunning({ InstanceId })
  }

  await associateElasticIp({ AllocationId, InstanceId })
  await sleep(15)

  const host = `ubuntu@${PublicIp}`
  const connect = async () => {
    await ssh({ host })
      .then(() => {
        setTimeout(() => {
          scp({ host }).catch(err => {
            console.log(err)
          })
        }, 1000 * 5)
      })
      .catch(() => {
        setTimeout(async () => {
          await connect()
        }, 1000 * 15)
      })
  }
  await connect()
}

module.exports = create
