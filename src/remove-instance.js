const AWS = require('aws-sdk')
const ec2 = new AWS.EC2({ region: process.env.AWS_REGION || 'us-east-1' })
const { sleep } = require('./util')
const path = require('path')
const { promisify } = require('util')
const fs = require('fs')
const unlink = promisify(fs.unlink)
const { HOME } = require('./constants')

const removeInstance = async (id) => {
  let { Reservations } = await ec2.describeInstances({ InstanceIds: [id] }).promise()
  let instance = Reservations.map(({ Instances }) => Instances[0])[0]
  let securityGroups = instance.SecurityGroups.filter(sg => /aws-vpn/.test(sg.GroupName))
  let { Addresses } = await ec2.describeAddresses().promise()
  let address = Addresses.find(({ InstanceId }) => InstanceId === id)
  await ec2.disassociateAddress({ AssociationId: address.AssociationId }).promise()
  await ec2.terminateInstances({ InstanceIds: [id] }).promise()
  let label = instance.Tags.find(({ Key }) => Key === 'Label').Value

  // const getStatus = async () => {
  //  let { InstanceStatuses } = await ec2.describeInstanceStatus({
  //    InstanceIds: [id]
  //  }).promise()
  //  console.log(InstanceStatuses)
  //  let status = InstanceStatuses.length &&
  //    InstanceStatuses[0].InstanceState.Name
  //  return status
  // }

  const removeSecurityGroups = async () => {
    try {
      await Promise.all(
        securityGroups.map(({ GroupId }) => ec2.deleteSecurityGroup({ GroupId }).promise())
      )
      return true
    } catch (err) {
      return false
    }
  }

  let removed = false
  while (!removed) {
    await sleep(5)
    removed = await removeSecurityGroups()
    console.log(removed)
  }
  await unlink(
    path.join(HOME, `${label}.ovpn`)
  )
}

module.exports = removeInstance
