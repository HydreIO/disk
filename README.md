<h1 align=center>@hydre/disk</h1>
<p align=center>
  <img src="https://img.shields.io/github/license/hydreio/disk.svg?style=for-the-badge" />
  <img src="https://img.shields.io/codecov/c/github/hydreio/disk/edge?logo=codecov&style=for-the-badge"/>
  <a href="https://www.npmjs.com/package/@hydre/disk">
    <img src="https://img.shields.io/npm/v/@hydre/disk.svg?logo=npm&style=for-the-badge" />
  </a>
  <img src="https://img.shields.io/npm/dw/@hydre/disk?logo=npm&style=for-the-badge" />
  <img src="https://img.shields.io/github/workflow/status/hydreio/disk/CI?logo=Github&style=for-the-badge" />
</p>

<h3 align=center>Store and query your GraphQL types in Redis</h3>

<p align=center>
  <img src="https://i.imgur.com/d1xlbYG.png" />
</p>


- [Requirements](#requirements)
- [Install](#install)
- [Usage](#usage)
  - [Schema](#schema)
  - [With Node](#with-node)

## Requirements

Hydre/disk leverage Graphql AST to provide an ORM kind tool
which map your schema to Redisearch indexes and allows you
to easily query your datas.

- Redis
- Redisearch module enabled
- Node > 14.4
- Advanced GraphQL knowledge

## Install

```sh
npm install @hydre/disk
```

## Usage

`hydre-disk` cli synchronize your GraphQL schema to Redisearch indexes
and reindex all hashes uppon changes. Use it manually or through your CI

`@hydre/disk` module provide you a query interface for usage in node

### Schema

> It is advised to use this tool in an advanced environement where
> you use schema generation and manage the AST yourself which would
> allow you to remove any trace of configuration mapping.

```sh
hydre-disk --file ./schema.gql --scan-count 1000
```

| flag | default value | description |
| --- | ---|---|
| `--file` | Error (mandatory) | direct path to a graphql schema file which contain your types |
| `--scan-count` | `100` | `COUNT` using while scanning redis for keys when reindexing hashes in an updated indexe @see https://redis.io/commands/scan|

Synchronization steps (current version)

1. The provided schema is parsed into a graphql ast
2. The graphql ast is parsed into a hydre/disk ast
3. Each graphql `type` definition represent a redisearch index
4. `FT.INFO` is used to check for index existence
5. If the index exist we skip it >> _go to 3_
   - this step is subject to evolve but in the current version of the tool
  you will have to manually drop an index in order to let `hydre-disk`
  create it and reindex existing hashes (which is pretty fast anyway).
   - The cli just provide some help for creation and reindexing but
  if you are an experienced redis user you absolutely can `FT.ALTER` and
  reindex existing hashes yourself
   - Skipping existing index also allows to run the cli without risking
  any flaws
6. If the index doesn't exist, the ast is serialized into a `FT.CREATE` command
   and executed for the `type` (see examples below)
7. After creating the index, the hashes are reindexed serialy with `FT.ADDHASH`
   with a `SCAN <cursor> MATCH <namespace:*> COUNT <scan-count>`
   - `namespace` is the graphql `type` name, which is also the index name

> WARN: Reindexed hashes will loose their document `WEIGHTS`, the scope of this tool
> has no interest in using this redisearch feature so if you need documents
> weight, you'll need to reindex them manually

hydre/disk is a 1-1 mapping with [available schema options](https://oss.redislabs.com/redisearch/Commands/#ftcreate)
```gql
type {index}
  @MAXTEXTFIELDS
  @TEMPORARY(seconds: Int!)
  @NOOFFSETS
  @NOHL
  @NOFIELDS
  @NOFREQS
  @STOPWORDS(words: [String!]!)
    {
      {field}: ... @TEXT @NOSTEM @WEIGHT(weight: Int! | Float!) @PHONETIC(matcher: String!)
      {field}: ... @NUMERIC
      {field}: ... @GEO
      {field}: ... @TAG @SEPARATOR(sep: String!)
      {field}: ... @{type} @SORTABLE @NOINDEX
}
```

The tool detect fields through their **primary positionned** directives.
If none of them is detected the `type` will simply be ignored.

```js
const FIELD_TYPES = new Set(['TEXT', 'NUMERIC', 'GEO', 'TAG'])
```

Redisearch is an interface on top of redis hashes which are independants,
that mean you can use a real graphql schema and specify redisearch directives
only on field which needs to be queried by secondary indexes (more on the
example below)

About shipping the schema it is cleaner if you can `visit` the ast
to remove directives before production to keep them internally,
the second best option is to extract
the types from your API schema and keep a graphql file dedicated only to redis,
the third option is to declare all directives at the top of your schema to
make them valid.

> I myself only write types and generate multiple things from it, including
> the production schema which contains no directives at all and is used remotly.

**Real usecase :**

```gql
type User @MAXTEXTFIELDS {
  uuid    : ID!
  name    : String! @TEXT @NOSTEM
  address : String!
  posts   : [Post!]!
  cities  : [String!]! @TAG @SEPARATOR(sep: ",")
}

type Post @STOPWORDS(words: ["i", "know", "right"]) {
  uuid   : ID!
  date   : Int! @NUMERIC
  text   : String @TEXT @WEIGHT(weight: 12.3)
}
```
Will yield

```sh
FT.CREATE User MAXTEXTFIELDS SCHEMA name TEXT NOSTEM cities TAG SEPARATOR ,
FT.CREATE Post STOPWORDS "i" "know" "right" SCHEMA date NUMERIC text TEXT WEIGHT 12.3
```

> I assume you're an adult and know what you are doing, no validation is done.
> That mean if you specify an invalid set of directives or wrong types
> you'll simply get a raw redis error.

### With Node

```js
```
