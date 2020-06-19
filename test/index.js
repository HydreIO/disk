import Doubt from '@hydre/doubt'
import reporter from 'tap-spec-emoji'
import { pipeline, PassThrough } from 'stream'
import Docker from 'dockerode'
import redis from 'redis'
import util from 'util'
import cli_suite from './cli.test.js'

const through = new PassThrough()

pipeline(
    through,
    reporter(),
    process.stdout,
    () => {},
)

redis.addCommand('FT.ADDHASH')
redis.addCommand('FT.INFO')
redis.addCommand('FT.CREATE')

const docker = new Docker()
const container = await docker.createContainer({
  Image       : 'redislabs/redisearch:latest',
  AttachStdout: false,
  HostConfig  : {
    NetworkMode: 'host',
  },
})
const doubt = Doubt({
  stdout : through,
  title  : 'Disk',
  calls  : 11,
  timeout: 1000,
})

await container.start()
await new Promise(resolve => setTimeout(resolve, 20))

const client = redis.createClient()
const send = util.promisify(client.send_command.bind(client))

await new Promise(resolve => {
  client.on('ready', resolve)
})

await cli_suite(doubt, send, client)
await new Promise(resolve => {
  client.quit(resolve)
})
await container.stop()
await container.remove()
