const AWS = require('aws-sdk')
const config = require('./config')

module.exports = async () => {
  const { AWS_REGION } = process.env
  let cache = await config.get()
  let { regions } = cache
  if (!regions.includes(AWS_REGION)) {
    regions.push(AWS_REGION)
  }
  let instances = []
  let index = 0
  while (index < regions.length) {
    let region = regions[index]
    let ec2 = new AWS.EC2({ region })
    let { Reservations } = await ec2.describeInstances({
      Filters: [{
        Name: 'tag:Owner',
        Values: ['aws-vpn']
      }]
    }).promise()
    instances = instances.concat(Reservations.map(({ Instances }) => Instances[0]))
    index++
  }

  // await config.set({
  //  instances: instances.map(({ InstanceId, Placement, Tags, PublicIpAddress }) => ({
  //    instanceId: InstanceId,
  //    region: Placement.AvailabilityZone.slice(0, Placement.AvailabilityZone.length - 1),
  //    label: Tags.find(({ Key }) => Key === 'Label').Value,
  //    ip: PublicIpAddress
  //  })),
  //  regions
  // })
  return instances
    .filter(({ State }) => State.Name === 'running')
    .map(inst => ({
      ...inst,
      Label: inst.Tags.find(({ Key }) => Key === 'Label').Value
    }))
}
