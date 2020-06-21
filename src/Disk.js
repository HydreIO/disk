import { v4 as uuid4 } from 'uuid'
import Parser from './Parser.js'
import Call from './Call.js'

const complex_query = (
    namespace,
    { keys, fields, limit = 0, offset = 0, search } = {},
) => [
  'FT.SEARCH',
  namespace,
  search,
  ...keys ? ['INKEYS', keys.length, keys] : [],
  ...fields?.length
    ? ['INFIELDS', fields.length, fields, 'RETURN', fields.length, fields]
    : [],
  ...limit > 0 ? ['LIMIT', offset, Math.min(1, limit)] : [],
]
const proxify = handle =>
  new Proxy(Object.create(null), {
    get: (_, namespace) => payload => handle(namespace, payload),
  })
const adequate_command = requested_fields => {
  if (!requested_fields || !requested_fields.length) return 'HGETALL'
  if (requested_fields.length === 1) return 'HGET'
  return 'HMGET'
}

export default ({
  client,
  events_enabled = false,
  events_name = '__disk__',
} = {}) => {
  const call = Call(client)
  const keys = async (namespace, query = {}) => {
    if (query.search) {
      const [, ...ids] = await call.one([
        complex_query(namespace, query),
        'NOCONTENT',
      ])

      return ids
    }

    const { keys: search_keys = [], limit = Infinity, offset = 0 } = query

    if (!search_keys.length) {
      // if no limit we return the whole db
      const operation = limit === Infinity
        ? ['KEYS', `${ namespace }:*`]
        : ['SCAN', offset, 'MATCH', `${ namespace }:*`, limit, 'TYPE', 'hash']

      return call.one(operation)
    }

    return search_keys.slice(offset, limit)
  }

  return {
    KEYS  : proxify(keys),
    CREATE: proxify(async (namespace, { document }) => {
      const uuid = `${ namespace }:${ uuid4() }`
      const filter_nulls = ([, value]) => value !== undefined && value !== null
      const entries = Object.entries(document).filter(filter_nulls)

      await call.one(['HSET', uuid, entries])
      try {
        // trying to index manually a created hash (may not have any index)
        // https://github.com/RediSearch/RediSearch/issues/1287#issuecomment-646511427
        // we can remove this in the next redisearch version
        await call.one(['FT.ADD', namespace, uuid, 1, 'FIELDS', entries])
      } catch {
        // we don't care if it works or not
      }

      if (events_enabled) {
        const cmd = ['publish', `${ events_name }:CREATE:${ namespace }`, uuid]

        await call.one(cmd)
      }

      return uuid
    }),
    GET: proxify(async (namespace, query) => {
      const find_results = async () => {
        // presence of search means we can't use regular HMGET
        if (query.search) {
          const [, ...results] = await call.one(complex_query(namespace, query))

          return results
        }

        const { keys: skeys = [], fields, limit = Infinity, offset = 0 } = query
        const command = adequate_command(fields)
        const commands = skeys
            .slice(offset, limit)
            .map(key => [command, key, ...fields])

        if (!commands.length) return []
        return call.many(commands)
      }

      return Parser.array_result(await find_results())
    }),
    SET: proxify(async (namespace, query) => {
      const { document } = query
      const ids = await keys(namespace, query)

      if (!ids.length) return []

      const fields_to_delete = new Set()
      const entries = Object.entries(document).filter(([key, value]) => {
        if (value === undefined || value === null) {
          fields_to_delete.add(key)
          return false
        }

        return true
      })
      const deletion_values = [...fields_to_delete.values()]

      if (deletion_values.length)
        await call.many(ids.map(id => ['HDEL', id, ...deletion_values]))

      const make_result = () => {
        if (query.search) {
          const head = ['FT.ADD', namespace]
          const tail = [1, 'REPLACE', 'PARTIAL', 'FIELDS', entries]

          return call.many(ids.map(id => [...head, id, ...tail]))
        }

        return call.many(ids.map(id => ['HSET', id, entries]))
      }
      const result = await make_result()

      if (events_enabled) {
        const to_operation = id => [
          'publish',
          `${ events_name }:SET:${ namespace }`,
          id,
        ]

        await call.many(ids.map(to_operation))
      }

      return result
    }),
    DELETE: proxify(async (namespace, query) => {
      const ids = await keys(namespace, query)

      if (!ids.length) return []
      if (events_enabled) {
        const to_operation = id => [
          'publish',
          `${ events_name }:DELETE:${ namespace }`,
          id,
        ]

        await call.many(ids.map(to_operation))
      }

      try {
        // trying to index manually a created hash (may not have any index)
        // https://github.com/RediSearch/RediSearch/issues/1287#issuecomment-646511427
        // we can remove this in the next redisearch version
        await call.many(ids.map(id => ['FT.DEL', namespace, id]))
      } catch {
        // we don't care if it works or not
      }

      return call.one(['DEL', ...ids])
    }),
  }
}
