import { v4 as uuid4 } from 'uuid'
import Ast from './ast.js'

const schema = /* GraphQL */ `
  type User @MAXTEXTFIELDS {
    uuid: ID!
    name: String! @TEXT @NOSTEM
    address: String!
    posts: [Post!]!
    cities: [String!]! @TAG @SEPARATOR(sep: ",")
  }

  type Post @STOPWORDS(words: ["i", "know", "right"]) {
    uuid: ID!
    date: Int! @NUMERIC
    text: String @TEXT @WEIGHT(weight: 12.3)
  }
`

process.env.REDIS_SCHEMA = schema

const asts = Ast.from_graphql(schema)

console.dir(Ast.to_query(asts[0]), {
  depth : Infinity,
  colors: true,
})

console.dir(Ast.to_query(asts[1]), {
  depth : Infinity,
  colors: true,
})

export default new Proxy(
    {
      CREATE: Symbol('create'),
      DELETE: Symbol('delete'),
      GET   : Symbol('get'),
      SET   : Symbol('set'),
      EXIST : Symbol('exist'),
      COUNT : Symbol('count'),
    },
    {
      get: (target, node) => {
        if (node in target) return Reflect.get(target, node)
        if (node === 'then') return undefined
        return async ({ type, filter, match, fields }) => {
          switch (type) {
            case target.GET:
              return 0

            case target.SET:
              return 0

            case target.EXIST:
              return 0

            case target.CREATE:
              const { uuid } = fields ?? { uuid: uuid4() }
              const mapped_fields = Object.entries(fields).map(([key, value]) => `${ key } ""`)

              await call('FT.ADD ')
              return 0

            case target.DELETE:
              return 0

            case target.COUNT:
              return 0

          // no default
          }
        }
      },
    },
)
