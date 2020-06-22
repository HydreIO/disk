/* eslint-disable max-lines */
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
    foo    : undefined,
  }
  const pepeg_id = await Disk.CREATE.User({ document: pepeg })
  const frog = await Disk.CREATE.Frog({ document: { name: 'Frog' } })

  doubt['[disk] Creating a document without schema use regular cmds']({
    because: frog.startsWith('Frog:'),
    is     : true,
  })
  doubt['[disk] Keys of a schemaless type can be queried']({
    because: await Disk.KEYS.Frog(),
    is     : [frog],
  })
  for (const index of new Array(10).keys()) {
    await Disk.CREATE.Plane({
      document: {
        can: 'fly',
        index,
      },
    })
  }

  doubt['[disk] Keys of a schemaless type can be queried with a limit (less)']({
    because: (await Disk.KEYS.Plane({ limit: 30 })).length,
    is     : 10,
  })
  for (const index of new Array(100).keys()) {
    await Disk.CREATE.Plane({
      document: {
        can: 'fly',
        index,
      },
    })
  }

  doubt['[disk] Keys of a schemaless type can be queried with a limit (more)']({
    because: (await Disk.KEYS.Plane({ limit: 30 })).length,
    is     : 30,
  })
  doubt['[disk] Fields of a schemaless type can be set']({
    because: await Disk.SET.Frog({
      keys    : [frog],
      document: { name: 'Froggy' },
    }),
    is: [0],
  })
  doubt['[disk] Fields of a schemaless type can be queried (HGETALL)']({
    because: await Disk.GET.Frog({
      keys : [frog, frog],
      limit: 1,
    }),
    is: [{ name: 'Froggy' }],
  })
  doubt['[disk] Fields of a schemaless type can be queried (HGET)']({
    because: await Disk.GET.Frog({
      keys  : [frog],
      fields: ['name'],
    }),
    is: [{ name: 'Froggy' }],
  })
  doubt['[disk] Fields of a schemaless type can be queried (HMGET)']({
    because: await Disk.GET.Frog({
      keys  : [frog],
      fields: ['name', 'age'],
    }),
    is: [
      {
        name: 'Froggy',
        age : undefined,
      },
    ],
  })
  doubt['[disk] a schemaless type can be deleted']({
    because: await Disk.DELETE.Frog(),
    is     : 1,
  })
  doubt['[disk] deleting empty results return 0']({
    because: await Disk.DELETE.Frog(),
    is     : 0,
  })
  doubt['[disk] set empty results return []']({
    because: await Disk.SET.Frog(),
    is     : [],
  })

  doubt['[disk] Creating a document return an uuid']({
    because: typeof pepeg_id,
    is     : 'string',
  })

  const monka_id = await Disk.CREATE.User({ document: monka })
  const [miss_field] = await Disk.GET.User({
    search: '@name:{M\\@nka}',
    limit : 1,
  })

  doubt['[disk] Undefined fields on creation are ignored']({
    because: miss_field.foo,
    is     : undefined,
  })

  doubt['[disk] Creating another document return a different uuid']({
    because: monka_id === pepeg_id,
    is     : false,
  })
  doubt['[disk] A created uuid includes the namespace']({
    because: pepeg_id.indexOf('User:'),
    is     : 0,
  })
  doubt['[disk] Keys give back 2 uuids']({
    because: (await Disk.KEYS.User()).length,
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

  await Disk.SET.User({
    search  : '@name:{Osbert}',
    document: {
      name: 'Osbert',
      age : undefined,
    },
  })

  doubt['[disk] Setting a field to undefined removes it']({
    because: (
      await Disk.GET.User({
        search: '@name:{Osbert}',
      })
    )[0].age,
    is: undefined,
  })

  doubt['[disk] Deleting users succeeds']({
    because: await Disk.DELETE.User({ search: '*' }),
    is     : 2,
  })
  doubt['[disk] Deleting users persists']({
    because: await send('KEYS', ['User:*']),
    is     : [],
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
