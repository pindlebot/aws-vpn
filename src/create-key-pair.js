const AWS = require('aws-sdk')
const { KEY_NAME } = require('./constants')

const createKeyPair = () => {
  const ec2 = new AWS.EC2({ region: process.env.AWS_REGION })

  return ec2.createKeyPair({
    KeyName: KEY_NAME
  }).promise()
}

module.exports = createKeyPair
