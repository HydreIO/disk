import { promisify } from 'util'
import { v4 as uuid4 } from 'uuid'
import redis from 'redis'
import Debug from 'debug'

const { REDIS_URL } = process.env
const debug = Debug('redisearch-orm')
const client = redis.createClient({
  url           : REDIS_URL,
  retry_strategy: ({ attempt, error }) => {
    debug('[redis]', error)
    if (attempt > 10)
      return new Error(`Can't connect to redis after ${ attempt } tries..`)
    return 250 * 2 ** attempt
  },
})
const call = promisify(client.send_command).bind(client)

await new Promise(resolve => {
  client.on('ready', resolve)
})

export default new Proxy({
  CREATE: Symbol('create'),
  DELETE: Symbol('delete'),
  GET   : Symbol('get'),
  SET   : Symbol('set'),
  EXIST : Symbol('exist'),
  COUNT : Symbol('count'),
}, {
  get: (target, node) => {
    if (node in target) return Reflect.get(target, node)
    if (node === 'then') return undefined
    return async ({ type, filter, match, fields }) => {
      switch (type) {
        case target.GET:
          return 0

        case target.SET:
          return 0

        case target.EXIST:
          return 0

        case target.CREATE:
          const { uuid } = fields ?? { uuid: uuid4() }
          const mapped_fields = Object.entries(fields)
              .map(([key, value]) => `${ key } ""`)

          await call('FT.ADD ')
          return 0

        case target.DELETE:
          return 0

        case target.COUNT:
          return 0

        // no default
      }
    }
  },
})
