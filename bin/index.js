#!/bin/sh
':' //# comment; exec /usr/bin/env node --harmony-top-level-await "$0" "$@"

import { readFileSync } from 'fs'
import sync             from '../src/synchronize.js'
import Redis            from 'ioredis'

const cmd                   = process.argv
const of                    = f => cmd.findIndex(x => x === f)
const flag                  = i => i === -1 ? undefined : cmd[i+1]
const file                  = flag(of('--file'))
const overwrite             = of('--sync')        !== -1
const redis_url             = flag(of('--redis')) ?? '127.0.0.1'
const schema                = readFileSync(file, 'utf-8')

if (!file) throw new Error('Please provide a schema with the --file flag')

const client = new Redis({
  host         : redis_url,
  retryStrategy: attempt => {
    if (attempt > 10) return new Error(`Can't connect to redis after ${ attempt } tries..`)
    return 250 * 2 ** attempt
  },
})

await sync({
  client,
  schema,
  logger: true,
  overwrite,
})

process.exit(0)
