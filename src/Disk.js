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
  ...fields?.length ? ['RETURN', fields.length, fields] : [],
  ...limit > 0 ? ['LIMIT', offset, Math.max(1, limit)] : [],
]
const proxify = handle =>
  new Proxy(Object.create(null), {
    get: (_, namespace) => query => {
      if (query?.fields) {
        // we always want the uuid inside a result
        query.fields = [...new Set([...query.fields, 'uuid']).values()]
      }

      return handle(namespace, query)
    },
  })
const adequate_command = requested_fields => {
  // no need to check if the array length is 0 because
  // as we always force include the `uuid`, it can never be 0
  if (!requested_fields) return 'HGETALL'
  if (requested_fields.length === 1) return 'HGET'
  return 'HMGET'
}

export default ({
  master_client,
  slave_client,
  events_enabled = false,
  events_name = '__disk__',
} = {}) => {
  const call = Call(master_client, slave_client)
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
      if (limit === Infinity) return call.one(['KEYS', `${ namespace }:*`])

      const scan_database = async (cursor, all = []) => {
        const operation = ['SCAN', cursor, 'MATCH', `${ namespace }:*`]
        const [next_cursor, scan_keys] = await call.one(operation)
        const concat = [...all, ...scan_keys]

        if (concat.length >= limit) return concat.slice(0, limit)
        if (+next_cursor) return scan_database(+next_cursor, concat)

        return concat
      }

      return scan_database(0)
    }

    return search_keys.slice(offset, limit)
  }

  return {
    KEYS  : proxify(keys),
    CREATE: proxify(async (namespace, { document }) => {
      const uuid = `${ namespace }:${ uuid4() }`

      document.uuid = uuid

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
        const cmd = ['PUBLISH', `${ events_name }:CREATE:${ namespace }`, uuid]

        await call.one(cmd)
      }

      return uuid
    }),
    GET: proxify(async (namespace, query) => {
      // presence of search means we can't use regular HMGET
      if (query.search) {
        const [, ...results] = await call.one(complex_query(namespace, query))

        return Parser.array_result(results)
      }

      /* c8 ignore next 13 */
      // this is actually covered but c8 doesn't pick it because of the
      // await keys, weird
      const {
        keys: skeys = await keys(namespace, query),
        fields,
        limit = Infinity,
        offset = 0,
      } = query
      const command = adequate_command(fields)
      const commands = skeys
          .slice(offset, limit)
          .map(key => [command, key, ...fields?.length ? fields : []])
      const results = await call.many(commands)

      if (command === 'HGETALL')
        // seems that the redis client already map HGETALL to an object
        return results.map(Parser.node)
      if (command === 'HGET')
        // HGET returns a direct value response
        return results.filter(x => !!x).map(result => ({ [fields[0]]: result }))

      // HMGET return an array response of values
      const to_entry = (value, i) => [fields[i], Parser.value(value)]

      return (
        results
        // filtering out not found documents
            .filter(values => !values.every(x => x === null))
            .map(values => Object.fromEntries(values.map(to_entry)))
      )
    }),
    SET: proxify(async (namespace, query = {}) => {
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
          'PUBLISH',
          `${ events_name }:SET:${ namespace }`,
          id,
        ]

        await call.many(ids.map(to_operation))
      }

      return result
    }),
    DELETE: proxify(async (namespace, query) => {
      const ids = await keys(namespace, query)

      if (!ids.length) return 0
      if (events_enabled) {
        const to_operation = id => [
          'PUBLISH',
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
