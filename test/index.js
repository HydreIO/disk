import Doubt from '@hydre/doubt'
import reporter from 'tap-spec-emoji'
import { pipeline, PassThrough } from 'stream'
import Docker from 'dockerode'
import Redis from 'ioredis'
import util from 'util'
import cli_suite from './cli.test.js'
import disk_suite from './disk.test.js'
import events from 'events'

const through = new PassThrough()

pipeline(through, reporter(), process.stdout, () => {})

const docker = new Docker()
const container = await docker.createContainer({
  Image       : 'redislabs/redisearch:latest',
  AttachStdout: false,
  HostConfig  : {
    NetworkMode: 'host',
  },
})
const doubt = Doubt({
  stdout: through,
  title : 'Disk',
  calls : 43,
})

try {
  await container.start()
  await new Promise(resolve => setTimeout(resolve, 100))

  const client = new Redis({
    retryStrategy: attempt => {
      if (attempt > 10)
        return new Error(`Can't connect to redis after ${ attempt } tries..`)
      return 250 * 2 ** attempt
    },
  })
  const send = util.promisify(client.call.bind(client))

  await events.once(client, 'ready')
  await cli_suite(doubt, send, client)
  await disk_suite(doubt, send, client)
  await client.quit()
} finally {
  await container.stop()
  await container.remove()
}
