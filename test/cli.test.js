import sync from '../src/synchronize.js'
import { readFileSync } from 'fs'

export default async (doubt, send, client) => {
  try {
    await send('FT.INFO', ['User'])
  } catch (error) {
    doubt['[cli] The Redis instance should have no indexes']({
      because: error.message,
      is     : 'Unknown Index name',
    })
  }

  const schema = readFileSync('./test/schema.gql', 'utf-8')

  await sync(client, schema, 10, false)

  const user_result = await send('FT.INFO', ['User'])
  const post_result = await send('FT.INFO', ['Post'])

  doubt['[cli] The Redis instance have an User index']({
    because: user_result.length,
    is     : 38,
  })

  doubt['[cli] The User schema contains a MAXTEXTFIELDS option']({
    because: user_result[3],
    is     : ['MAXTEXTFIELDS'],
  })

  doubt['[cli] The User schema include all defined search fields']({
    because: user_result[5],
    is     : [
      ['name', 'type', 'TEXT', 'WEIGHT', '1', 'NOSTEM'],
      ['age', 'type', 'NUMERIC'],
      ['cities', 'type', 'TAG', 'SEPARATOR', ','],
    ],
  })

  doubt['[cli] Redis instance should have a Post index']({
    because: post_result.length,
    is     : 40,
  })

  doubt['[cli] The Post schema include all defined search fields']({
    because: post_result[5],
    is     : [
      ['date', 'type', 'NUMERIC'],
      ['text', 'type', 'TEXT', 'WEIGHT', '12.300000000000001'],
    ],
  })

  doubt['[cli] The Post schema includes defined stopwords']({
    because: post_result[39],
    is     : ['i', 'know', 'right'],
  })

  await sync(client, schema, 10, false)

  doubt[`[cli] Running the sync again doesn't change anything`]({
    because: (await send('FT.INFO', ['User'])).length,
    is     : 38,
  })

  for (let i = 0; i < 20; i++)
    await send('HSET', [`Post:${ i }`, 'text', `${ i }sceat`])
  await send('FT.DROP', ['Post', 'KEEPDOCS'])

  try {
    await send('FT.INFO', ['Post'])
  } catch (error) {
    doubt['[cli] After droping the Post index it should not exist']({
      because: error.message,
      is     : 'Unknown Index name',
    })
  }

  doubt['[cli] But the hash should still exist']({
    because: await send('HGET', ['Post:1', 'text']),
    is     : '1sceat',
  })

  await sync(client, schema, 10, false)

  doubt['[cli] We indexed again, we can now query the hash']({
    because: await send('FT.SEARCH', ['Post', '5sce*']),
    is     : [1, 'Post:5', ['text', '5sceat']],
  })

  await send('FT.DROP', ['Post'])

  doubt['[cli] Ensure every documents has been dropped']({
    because: await send('HGET', ['Post:1', 'text']),
    // eslint-disable-next-line unicorn/no-null
    is     : null,
  })
}
