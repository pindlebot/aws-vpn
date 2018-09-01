const AWS = require('aws-sdk')
const { genId } = require('./util')
const { PREFIX } = require('./constants')

const createSecurityGroup = () => {
  const ec2 = new AWS.EC2({ region: process.env.AWS_REGION })

  const id = genId()
  const GroupName = `${PREFIX}.micro-${id}`
  return ec2.createSecurityGroup({
    Description: `OpenVPN ${id}`,
    GroupName: GroupName
  }).promise()
}

module.exports = createSecurityGroup
