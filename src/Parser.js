const chunk = (array, size) => {
  if (!array.length) return []

  const head = array.slice(0, size)
  const tail = array.slice(size)

  return [head, ...chunk(tail, size)]
}
const Parser = {
  value: value => {
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
  },
  entry       : ([key, value]) => [key, Parser.value(value)],
  node        : node => Object.fromEntries(chunk(node, 2).map(Parser.entry)),
  array_result: array =>
    chunk(array, 2)
        .map(([key, value]) => ['uuid', key, ...value])
        .map(Parser.node),
}

export default Parser
