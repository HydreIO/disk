import { v4 as uuid4 } from 'uuid'
import Parser from './Parser.js'
import Call from './Call.js'

const search_missing = () => {
  throw new Error('Missing search field in query')
}
const build_query = (
    namespace,
    { keys, fields, limit = 0, offset = 0, search = search_missing() } = {},
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

export default ({
  client,
  events_enabled = false,
  events_name = '__disk__',
} = {}) => {
  const call = Call(client)
  const keys = async (namespace, query) => {
    const [, ...ids] = await call.one([
      build_query(namespace, query),
      'NOCONTENT',
    ])

    return ids
  }

  return {
    KEYS  : proxify(keys),
    CREATE: proxify(async (namespace, { document }) => {
      const uuid = `${ namespace }:${ uuid4() }`
      const entries = Object.entries(document).filter(([, value]) => value !== undefined && value !== null)

      await call.one(['FT.ADD', namespace, uuid, 1, 'FIELDS', entries])
      if (events_enabled) {
        const cmd = ['publish', `${ events_name }:CREATE:${ namespace }`, uuid]

        await call.one(cmd)
      }

      return uuid
    }),
    GET: proxify(async (namespace, query) => {
      const [, ...results] = await call.one(build_query(namespace, query))

      return Parser.array_result(results)
    }),
    SET: proxify(async (namespace, query) => {
      const { document } = query
      const ids = await keys(namespace, query)
      const fields_to_delete = new Set()
      const entries = Object.entries(document).filter(([key, value]) => {
        if (value === undefined || value === null) {
          fields_to_delete.add(key)
          return false
        }

        return true
      })
      const head = ['FT.ADD', namespace]
      const tail = [1, 'REPLACE', 'PARTIAL', 'FIELDS', entries]
      const deletion_values = [...fields_to_delete.values()]

      if (deletion_values.length)
        await call.many(ids.map(id => ['HDEL', id, ...deletion_values]))

      const result = await call.many(ids.map(id => [...head, id, ...tail]))

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

      if (events_enabled) {
        const to_operation = id => [
          'publish',
          `${ events_name }:DELETE:${ namespace }`,
          id,
        ]

        await call.many(ids.map(to_operation))
      }

      return call.many(ids.map(id => ['FT.DEL', namespace, id, 'DD']))
    }),
  }
}
