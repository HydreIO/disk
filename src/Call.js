import debug from 'debug'
import { inspect } from 'util'

const log = debug('disk')
const WRITES = new Set([
  'HSET',
  'FT.ADD',
  'FT.CREATE',
  'PUBLISH',
  'DEL',
  'FT.DEL',
  'FT.DROP',
  'FT.ADDHASH',
])
const is_read_only = command => !WRITES.has(command.toUpperCase())

export default (master, slave = master) =>
  new Proxy(
      {},
      {
        get: (_, mode) => queries => {
          switch (mode.toLowerCase()) {
            case 'one':
              return new Promise((resolve, reject) => {
                const [command, ...parameters] = queries.flat(Infinity)
                const client = is_read_only(command) ? slave : master

                log.extend('one')('%O', [command, ...parameters])

                client.call(command, parameters, (error, result) => {
                  if (error) reject(error)
                  else resolve(result)
                })
              })

            case 'many':
              return new Promise((resolve, reject) => {
                const flat = queries.map(query => query.flat(Infinity))
                const client = flat.every(([cmd]) => is_read_only(cmd))
                ? slave
                : master

                log.extend('many')(inspect(flat, false, Infinity, true))

                client
                    .multi(flat.map(cmds => ['call', ...cmds]))
                    .exec((exe_error, results) => {
                      if (exe_error) {
                        reject(exe_error)
                        return
                      }

                      for (const [error] of results) {
                        if (error) {
                          reject(error)
                          return
                        }
                      }

                      resolve(results.flat(1).filter(x => !!x))
                    })
              })

            default:
              return Reflect.get(_, mode)
          }
        },
      },
  )
