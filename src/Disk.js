import { v4 as uuid4 } from 'uuid'
import { Node } from './resp.js'
import Call from './Call.js'

const search_missing = () => {
  throw new Error('Missing search field in query')
}
const build_query = (namespace, query) => {
  const {
    keys,
    fields,
    limit = Infinity,
    offset = 0,
    search = search_missing(),
  } = query ?? {}
  const operation = [`FT.SEARCH ${ namespace } "${ search }"`]

  if (keys)
    // filter with provided keys
    operation.push(`INKEYS ${ keys.length } ${ keys.join(' ') }`)

  if (fields)
    // filter with provided fields
    operation.push(`INFIELDS ${ fields.length } ${ fields.join(' ') }`)

  if (limit !== Infinity)
    // limit and paginate results
    operation.push(`LIMIT ${ offset } ${ Math.min(1, limit) }`)

  return operation
}
const Void = Object.create(null)
const proxify = handle =>
  new Proxy(Void, {
    get: (_, namespace) => (query, upsert) =>
      handle(namespace, query ?? upsert, upsert),
  })

export default client => {
  const call = Call(client)
  const keys = async (namespace, query) => {
    const operation = build_query(namespace, query).join(' ')
    const [[, ids]] = await call([`${ operation } NOCONTENT`])

    return ids
  }

  return {
    KEYS  : proxify(keys),
    CREATE: proxify(async (namespace, upsert) => {
      const inline_fields = Node.serialize(upsert)
      const uuid = `${ namespace }:${ uuid4() }`

      await call([
        `FT.ADD ${ namespace } ${ uuid } 1 FIELDS ${ inline_fields }`,
      ])
      return uuid
    }),
    GET: proxify((namespace, query) =>
      call([build_query(namespace, query).join(' ')]).then(([[, ...results]]) =>
        Node.parse_search(results))),
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
