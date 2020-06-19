import { v4 as uuid4 } from 'uuid'
import { Node } from './resp.js'
import Call from './Call.js'

const search_missing = () => {
  throw new Error('Missing search field in query')
}
const assign_if = (condition, value) => condition ? value : []
const build_query = (
    namespace,
    { keys, fields, limit = 0, offset = 0, search = search_missing() } = {},
) => [
  'FT.SEARCH',
  namespace,
  search,
  ...keys ? ['INKEYS', keys.length, keys] : [],
  ...fields ? ['INFIELDS', fields.length, fields] : [],
  ...limit > 0 ? ['LIMIT', offset, Math.min(1, limit)] : [],
]
const proxify = handle =>
  new Proxy(Object.create(null), {
    get: (_, namespace) => (query, upsert) =>
      handle(namespace, query ?? upsert, upsert),
  })

export default client => {
  const call = Call(client)
  const keys = async (namespace, query) => {
    const [, ids] = await call.one([build_query(namespace, query), 'NOCONTENT'])

    return ids
  }

  return {
    KEYS  : proxify(keys),
    CREATE: proxify(async (namespace, upsert) => {
      const uuid = `${ namespace }:${ uuid4() }`

      await call.one([
        'FT.ADD',
        namespace,
        uuid,
        1,
        'FIELDS',
        Object.entries(upsert),
      ])
      return uuid
    }),
    GET: proxify(async (namespace, query) => {
      const [, ...results] = await call.one(build_query(namespace, query))

      return Node.parse_search(results)
    }),
    SET: proxify(async (namespace, query, upsert) => {
      const ids = await keys(namespace, query)
      const inline_fields = Node.serialize(upsert)
      const query_start = `FT.ADD ${ namespace }`
      const query_end = `1 FIELDS ${ inline_fields } REPLACE PARTIAL`

      return call(ids.map(id => `${ query_start } ${ id } ${ query_end }`))
    }),
    DELETE: proxify((namespace, query) =>
      keys(namespace, query).then(ids =>
        call(ids.map(id => `FT.DEL ${ namespace } ${ id } DD`)))),
  }
}
