const AWS = require('aws-sdk')
const ec2 = new AWS.EC2({ region: process.env.AWS_REGION })

const addInboundRule = (GroupId, permissions) => {
  return ec2.authorizeSecurityGroupIngress({
    GroupId: GroupId,
    IpPermissions: permissions.map(permission => ({
      FromPort: permission.Port,
      ToPort: permission.Port,
      IpProtocol: permission.IpProtocol || 'tcp',
      IpRanges: [{
        CidrIp: '0.0.0.0/0',
        Description: permission.Description || 'OpenVPN'
      }]
    }))
  }).promise()
}

module.exports = addInboundRule
