const AWS = require('aws-sdk')
const { KEY_NAME } = require('./constants')
const { exec } = require('child_process')
const { getLocation } = require('./util')

const createScript = ({ ip, org, label, location, email }) => `#!/usr/bin/env bash

INSTANCE_ID=$(curl http://169.254.169.254/latest/meta-data/instance-id)
exec > /tmp/part-001.log 2>&1
cd ~
git clone https://github.com/redgeoff/openvpn-server-vagrant
cd openvpn-server-vagrant
echo -e '#!/usr/bin/env bash\n\nKEY_COUNTRY="US"\nKEY_PROVINCE="${location.region}"\nKEY_CITY="${location.city}"\nKEY_ORG="${org}"\nKEY_EMAIL="${email}"\nKEY_OU="default"\n\nPUBLIC_IP="${ip}"' > config.sh
~/openvpn-server-vagrant/ubuntu.sh
~/openvpn-server-vagrant/openvpn.sh
echo 'push "route 172.31.0.0 255.255.0.0"' >> /etc/openvpn/server.conf
systemctl restart openvpn@server
~/openvpn-server-vagrant/add-client.sh ${label}
cp /root/client-configs/files/${label}.ovpn /home/ubuntu/${label}.ovpn
chown ubuntu:ubuntu /home/ubuntu/${label}.ovpn
`

const AMAZON_IMAGES = require('./amazon-images')

const createInstance = async ({ GroupId, PublicIp }) => {
  const { ami } = AMAZON_IMAGES.find(({ region }) => region === process.env.AWS_REGION)
  const ec2 = new AWS.EC2({ region: process.env.AWS_REGION })

  const email = await new Promise((resolve, reject) =>
    exec('git config --get user.email', {}, (err, data) => {
      if (err) reject(err)
      else resolve(data.trim())
    })
  )
  const location = await getLocation()
  const org = process.env.OPEN_VPN_ORG
  const label = process.env.OPEN_VPN_LABEL
  const script = createScript({ ip: PublicIp, org, label, location, email })
  const UserData = Buffer.from(script).toString('base64')
  const { Instances } = await ec2.runInstances({
    SecurityGroupIds: [GroupId],
    KeyName: KEY_NAME,
    InstanceType: 't2.micro',
    ImageId: ami,
    MaxCount: 1,
    MinCount: 1,
    TagSpecifications: [{
      ResourceType: 'instance',
      Tags: [{
        Key: 'Owner',
        Value: 'aws-vpn'
      }, {
        Key: 'Label',
        Value: label
      }]
    }],
    UserData: UserData
  }).promise()
  const { InstanceId } = Instances[0]
  return {
    InstanceId
  }
}

module.exports = createInstance
