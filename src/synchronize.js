import Debug from 'debug'
import { call } from './redis.js'
import Ast from './ast.js'

const debug = Debug('disk').extend('sync')
const index_hashes = async (namespace, cursor, count) => {
  const query = `SCAN ${ cursor } MATCH ${ namespace }:* COUNT ${ count }`
  const [next_cursor, documents] = await call(query)

  if (documents.length) {
    debug(
        `${ ' '.repeat(namespace.length) }  -> indexing %O hashes in index %O`,
        documents.length,
        namespace,
    )
  } else {
    debug(
        `${ ' '.repeat(namespace.length) }  -> no documents under %O`,
        namespace,
    )
  }

  for (const document of documents)
    await call(`FT.ADDHASH ${ namespace } ${ document } 1.0 REPLACE`)
  if (+next_cursor) await index_hashes(namespace, next_cursor, count)
}

export default async (schema, scan_count) => {
  if (!schema) throw new Error('No schema was provided')

  debug('Synchronizing schema..')
  for (const ast of Ast.from_graphql(schema)) {
    const {
      index: { name },
    } = ast
    const log = debug.extend(name)

    log('processing..')
    try {
      await call(`FT.INFO ${ name }`)
      log('Already exist, skipping..')
    } catch (error) {
      if (error.message !== 'Unknown Index name') {
        log('Unable to retrieves infos about index, aborting..')
        throw error
      }

      log('Creating.. (batch: %O)', scan_count)
      await call(Ast.to_query(ast))
      await index_hashes(name, 0, scan_count)
    }
  }
}
