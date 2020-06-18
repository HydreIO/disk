#!/bin/sh
':' //# comment; exec /usr/bin/env node --harmony-top-level-await "$0" "$@"

import { readFileSync } from 'fs'
import sync             from '../src/synchronize.js'

const cmd       = process.argv
const of        = f => cmd.findIndex(x => x === f)
const flag      = i => i === -1 ? undefined : cmd[i+1]
const file      = flag(of('--file'))
const count     = flag(of('--scan-count')) ?? 100
const redis_url = flag(of('--redis')) ?? 'redis://localhost:6379'
const schema    = readFileSync(file, 'utf-8')

if (!file) throw new Error('Please provide a schema with the --file flag')
await sync(redis_url, schema, count)
process.exit(0)