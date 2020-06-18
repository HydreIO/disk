import doubt from '@hydre/doubt'
import reporter from 'tap-spec-emoji'
import { pipeline } from 'stream'

pipeline(await doubt(Suite), reporter(), process.stdout, error => {
  if (error) console.error(error)
})
