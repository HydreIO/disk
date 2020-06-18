/* eslint-disable unicorn/no-reduce */
const replacer = (key, value) => {
  switch (typeof value) {
    case 'function':

    case 'bigint':
      return value.toString()

    case 'symbol':
      return undefined

    case 'undefined':
      return undefined

    case 'object':
      if (value === null) return undefined
    default:
      return value
  }
}
const reviver = (key, value) => {
  // as value come from redis it'll always be a string
  if (value === 'true') return true
  if (value === 'false') return false
  try {
    const number_value = BigInt(value)

    if (number_value <= Number.MAX_SAFE_INTEGER) return +value
    return number_value
  } catch {
    return value
  }
}
const Value = {
  serialize: value => JSON.stringify(value, replacer),
  parse    : value => JSON.parse(value, reviver),
}
const Entry = {
  serialize: ([key, value]) => `${ key } ${ Value.serialize(value) }`,
  parse    : ([key, value]) => ({ [key]: Value.parse(value) }),
}
const result_reducer = parse => (result, current, index, array) => {
  if (index & 1) return result
  return {
    ...result,
    ...parse([current, array[index + 1]]),
  }
}

export const Node = {
  parse       : array => array.reduce(result_reducer(Entry.parse), {}),
  parse_search: array => array.reduce(result_reducer(Node.parse), {}),
  serialize   : object =>
    Object.entries(object)
        .map(Entry.serialize)
        .join(' '),
}
