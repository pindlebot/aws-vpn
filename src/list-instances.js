const AWS = require('aws-sdk')
const ec2 = new AWS.EC2({ region: process.env.AWS_REGION || 'us-east-1' })

module.exports = async () => {
  let { Reservations } = await ec2.describeInstances({
    Filters: [{
      Name: 'tag:Owner',
      Values: ['aws-vpn']
    }]
  }).promise()
  let instances = Reservations.map(({ Instances }) => Instances[0])
  return instances
}
