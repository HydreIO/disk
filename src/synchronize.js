import Ast from './Ast.js'
import Call from './Call.js'

export default async (client, schema, scan_count, logger = true) => {
  if (!schema) throw new Error('No schema was provided')

  const call = Call(client)
  /* c8 ignore next 4 */
  // we disable logging in test and we don't want to test that
  const log = (...msgs) => {
    if (logger) console.log(...msgs)
  }
  const index_hashes = async (namespace, cursor, count) => {
    const query = ['SCAN', cursor, 'MATCH', `${ namespace }:*`, 'COUNT', count]
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
    if (+next_cursor) await index_hashes(namespace, next_cursor, count)
  }

  log('Synchronizing schema..')
  for (const ast of Ast.parse(schema)) {
    const {
      index: { name },
    } = ast

    log(`[${ name }] processing..`)
    try {
      await call.one(['FT.INFO', name])
      log(`[${ name }] Already exist, skipping..`)
    } catch {
      log(`[${ name }] Creating.. (batch: ${ scan_count })`)
      await call.one(Ast.serialize(ast))
      await index_hashes(name, 0, scan_count)
    }
  }
}
