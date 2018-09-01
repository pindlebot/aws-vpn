const AWS = require('aws-sdk')

module.exports = async ({ AllocationId, InstanceId }) => {
  const ec2 = new AWS.EC2({ region: process.env.AWS_REGION })

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
