import redis from 'redis'
import Mount from '../src/Disk.js'

redis.addCommand('FT.ADD')
redis.addCommand('FT.SEARCH')
redis.addCommand('FT.CREATE')
redis.addCommand('FT.DEL')

const client = redis.createClient({
  url           : 'redis://localhost:6379',
  retry_strategy: ({ attempt, error }) => {
    console.log('[redis]', error)
    if (attempt > 10)
      return new Error(`Can't connect to redis after ${ attempt } tries..`)

    return 250 * 2 ** attempt
  },
})

await new Promise(resolve => {
  client.on('ready', resolve)
})

const Disk = Mount(client)

// console.log(await Disk.CREATE.Post({
//   date: Date.now(),
//   text: `Lorem ipsum dolor sit amet,
// consectetur adipiscing elit, sed do eiusmod tempor incididunt ut
// labore et dolore magna aliqua. Ut enim ad minim veniam,
// quis nostrud exercitation
// ullamco laboris nisi ut aliquip ex ea commodo consequat.
// Duis aute irure dolor in
// reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
// Excepteur sint occaecat cupidatat non proident,
// sunt in culpa qui officia deserunt mollit anim id est laborum.`,
// }))
console.dir(await Disk.GET.Post({
  search: 'sint*',
}), {
  depth : Infinity,
  colors: true,
})
