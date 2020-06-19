import redis from 'redis'
import Ast from './Ast.js'
import Call from './Call.js'

redis.addCommand('FT.ADDHASH')
redis.addCommand('FT.INFO')
redis.addCommand('FT.CREATE')

export default async (url, schema, scan_count) => {
  if (!schema) throw new Error('No schema was provided')

  const client = redis.createClient({
    url,
    retry_strategy: ({ attempt, error }) => {
      console.log('[redis]', error)
      if (attempt > 10)
        return new Error(`Can't connect to redis after ${ attempt } tries..`)

      return 250 * 2 ** attempt
    },
  })
  const call = Call(client)
  const index_hashes = async (namespace, cursor, count) => {
    const query = ['SCAN', cursor, 'MATCH', `${ namespace }:*`, 'COUNT', count]
    const [next_cursor, documents] = await call.one(query)

    if (documents.length) {
      console.log(`${ ' '.repeat(namespace.length) }  \
  -> indexing ${ documents.length } hashes in index ${ namespace }`)
    } else {
      console.log(`${ ' '.repeat(namespace.length) }  \
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

  await new Promise(resolve => {
    client.on('ready', resolve)
  })

  console.log('Synchronizing schema..')
  for (const ast of Ast.parse(schema)) {
    const {
      index: { name },
    } = ast

    console.log(`[${ name }] processing..`)
    try {
      await call.one(['FT.INFO', name])
      console.log(`[${ name }] Already exist, skipping..`)
    } catch (error) {
      if (error.message !== 'Unknown Index name') {
        console.log(`[${ name }] Unable to retrieves \
infos about index, aborting..`)
        throw error
      }

      console.log(`[${ name }] Creating.. (batch: ${ scan_count })`)
      await call.one(Ast.serialize(ast))
      await index_hashes(name, 0, scan_count)
    }
  }
}
