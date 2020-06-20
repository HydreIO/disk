import Mount from '../src/Disk.js'
import Call from '../src/Call.js'

export default async (doubt, send, client) => {
  const Disk = Mount({
    client,
    events_enabled: true,
    events_name   : 'disk',
  })
  const pepeg = {
    name   : 'Pépeg',
    address: '5th street',
    cities : 'brooklyn,paris,miami',
  }
  const monka = {
    name   : 'M@nka',
    address: '6th street',
    cities : 'tokyo,paris,alger',
  }
  const pepeg_id = await Disk.CREATE.User({ document: pepeg })

  doubt['[disk] Creating a document return an uuid']({
    because: typeof pepeg_id,
    is     : 'string',
  })

  const monka_id = await Disk.CREATE.User({ document: monka })

  doubt['[disk] Creating another document return a different uuid']({
    because: monka_id === pepeg_id,
    is     : false,
  })
  doubt['[disk] A created uuid includes the namespace']({
    because: pepeg_id.indexOf('User:'),
    is     : 0,
  })
  doubt['[disk] Keys give back 2 uuids']({
    because: (await Disk.KEYS.User({ search: '*' })).length,
    is     : 2,
  })
  doubt['[disk] Keys limited to 1 give back 1 uuids']({
    because: (
      await Disk.KEYS.User({
        search: '*',
        limit : 1,
      })
    ).length,
    is: 1,
  })
  doubt['[disk] Keys limited to 0 give back 2 uuids']({
    because: (
      await Disk.KEYS.User({
        search: '*',
        limit : 0,
      })
    ).length,
    is: 2,
  })

  const [finding_alger] = await Disk.GET.User({
    search: '@cities:{alger}',
    fields: ['cities', 'name'],
  })

  doubt['[disk] A precise query give precise results']({
    because: finding_alger.name,
    is     : 'M@nka',
  })
  doubt['[disk] Fields are filtered']({
    because: finding_alger.address,
    is     : undefined,
  })
  doubt['[disk] Uuid is always present']({
    because: finding_alger.uuid,
    is     : monka_id,
  })

  const [finding_pepeg] = await Disk.GET.User({
    keys  : [pepeg_id],
    search: '*',
  })

  doubt['[disk] A query with keys give precise results']({
    because: finding_pepeg.name,
    is     : 'Pépeg',
  })

  try {
    await Disk.KEYS.User()
  } catch (error) {
    doubt['[disk] Querying without a search string throws an error']({
      because: error.message,
      is     : 'Missing search field in query',
    })
  }

  await Disk.SET.User({
    search  : '-(@name:{M\\@nka})',
    fields  : [],
    document: {
      name: 'Osbert',
      age : 1n,
    },
  })

  const [upsert] = await Disk.SET.User({
    search  : '-(@name:{M\\@nka})',
    fields  : [],
    document: {
      name: 'Osbert',
      age : 9999999999999999999999999n,
    },
  })


  await Disk.GET.User({
    search: '@name:{Osbert}',
    fields: [],
  })


  await Disk.SET.User({
    search  : '-(@name:{M\\@nka})',
    fields  : [],
    document: {
      name: 'Osbert',
      age : 1n,
    },
  })

  doubt['[disk] Updating pepeg name succeeds']({
    because: upsert,
    is     : 'OK',
  })

  const [osbert] = await Disk.GET.User({
    search: '@name:{Osbert}',
  })

  doubt['[disk] Updating pepeg name persists']({
    because: osbert.uuid,
    is     : pepeg_id,
  })
  doubt['[disk] Deleting users succeeds']({
    because: await Disk.DELETE.User({ search: '*' }),
    is     : [1, 1],
  })
  doubt['[disk] Deleting users persists']({
    because: await send('SCAN', [0, 'MATCH', 'User:*']),
    is     : ['0', []],
  })

  const call = Call(client)

  try {
    call.foo()
    await call.many([['FT.INFO', 'US']])
  } catch (error) {
    doubt['[disk] Call method allows multi error catching']({
      because: error.message,
      is     : 'Unknown Index name',
    })
  }

  try {
    call.foo()
    await call.many([['HMGET']])
  } catch ({ errors }) {
    doubt['[disk] Call method allows simple error catching']({
      because: errors[0].message,
      is     : `ERR wrong number of arguments for 'hmget' command`,
    })
  }
}
