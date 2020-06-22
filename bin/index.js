#!/bin/sh
':' //# comment; exec /usr/bin/env node --harmony-top-level-await "$0" "$@"

import { readFileSync } from 'fs'
import sync             from '../src/synchronize.js'
import redis            from 'redis'

redis.addCommand('FT.ADDHASH')
redis.addCommand('FT.INFO')
redis.addCommand('FT.CREATE')

const cmd                   = process.argv
const of                    = f => cmd.findIndex(x => x === f)
const flag                  = i => i === -1 ? undefined : cmd[i+1]
const file                  = flag(of('--file'))
const redis_url             = flag(of('--redis')) ?? 'redis://localhost:6379'
const schema                = readFileSync(file, 'utf-8')

if (!file) throw new Error('Please provide a schema with the --file flag')

const client = redis.createClient({
  url           : redis_url,
  retry_strategy: ({ attempt }) => {
    if (attempt > 10) return new Error(`Can't connect to redis after ${ attempt } tries..`)
    return 250 * 2 ** attempt
  },
})

await sync(client, schema, limit)
process.exit(0)
