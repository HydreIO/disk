import Ast from './Ast.js'
import Call from './Call.js'

export default async ({ client, schema, logger, overwrite }) => {
  if (!schema) throw new Error('No schema was provided')

  const call = Call(client)
  /* c8 ignore next 4 */
  // we disable logging in test and we don't want to test that
  const log = (...msgs) => {
    if (logger) console.log(...msgs)
  }
  const index_hashes = async (namespace, cursor) => {
    const query = ['SCAN', cursor, 'MATCH', `${ namespace }:*`]
    const [next_cursor, documents] = await call.one(query)

    if (documents.length) {
      log(`${ ' '.repeat(namespace.length) }  \
  -> indexing ${ documents.length } hashes in index ${ namespace }`)
    } else {
      log(`${ ' '.repeat(namespace.length) }  \
  -> no documents under ${ namespace }`)
    }

    const serialize = document => [
      'FT.ADDHASH',
      namespace,
      document,
      '1.0',
      'REPLACE',
    ]

    await call.many(documents.map(serialize))
    if (+next_cursor) await index_hashes(namespace, +next_cursor)
  }

  log('Synchronizing schema..')
  for (const ast of Ast.parse(schema)) {
    const {
      index: { name },
    } = ast

    log(`[${ name }] processing..`)
    try {
      await call.one(['FT.INFO', name])
      if (overwrite) {
        log(`[${ name }] Removing existing index..`)
        await call.one(['FT.DROP', name, 'KEEPDOCS'])
        throw 0
      } else log(`[${ name }] Already exist, skipping..`)
    } catch {
      log(`[${ name }] Creating index..`)
      await call.one(Ast.serialize(ast))
      await index_hashes(name, 0)
    }
  }
}
