import debug from 'debug'
import { inspect } from 'util'

const log = debug('disk')

export default client =>
  new Proxy(
      {},
      {
        get: (_, mode) => queries => {
          switch (mode.toLowerCase()) {
            case 'one':
              return new Promise((resolve, reject) => {
                const [command, ...parameters] = queries.flat(Infinity)

                log.extend('one')('%O', [command, ...parameters])

                client.send_command(command, parameters, (error, result) => {
                  if (error) reject(error)
                  else resolve(result)
                })
              })

            case 'many':
              return new Promise((resolve, reject) => {
                const flat = queries.map(query => query.flat(Infinity))

                log.extend('many')(inspect(flat, false, Infinity, true))

                client.multi(flat).exec((error, results) => {
                  if (error) {
                    reject(error)
                    return
                  }

                  for (const result of results) {
                    if (result instanceof Error) {
                      reject(result)
                      return
                    }
                  }

                  resolve(results)
                })
              })

            default:
              return Reflect.get(_, mode)
          }
        },
      },
  )
