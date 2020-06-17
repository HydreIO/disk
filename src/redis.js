import redis from 'redis'
import Debug from 'debug'

const { REDIS_URL } = process.env
const debug = Debug('disk')
const client = redis.createClient({
  url           : REDIS_URL,
  retry_strategy: ({ attempt, error }) => {
    debug('[redis]', error)
    if (attempt > 10)
      return new Error(`Can't connect to redis after ${ attempt } tries..`)

    return 250 * 2 ** attempt
  },
})

await new Promise(resolve => {
  client.on('ready', resolve)
})

export const call = query =>
  new Promise((resolve, reject) => {
    const [command, ...parameters] = query.split(' ')

    client.send_command(command, parameters, (error, result) => {
      if (error) reject(error)
      resolve(result)
    })
  })
