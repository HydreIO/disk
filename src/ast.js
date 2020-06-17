import { parse } from 'graphql/index.mjs'

const MULTIPART = new Set(['PHONETIC', 'WEIGHT', 'SEPARATOR'])
const FIELD_TYPES = new Set(['TEXT', 'NUMERIC', 'GEO', 'TAG'])
const extract_multipart_options = function *(options) {
  const clone = [...options]

  while (clone.length) {
    const next = clone.shift()

    yield {
      name: next,
      ...MULTIPART.has(next) && { value: clone.shift() },
    }
  }
}
const parse_name = ({ name: { value } }) => value
const drop_invalid_field = ({ directives }) =>
  directives.length && FIELD_TYPES.has(parse_name(directives[0]))
const parse_option = directive => ({
  name : parse_name(directive),
  value: directive.arguments.map(argument => {
    const {
      value: { kind: argument_type, value, values },
    } = argument

    if (argument_type === 'ListValue') return values.map(_ => _.value)
    if (argument_type === 'StringValue') return value
    return +value
  })[0],
})
const serialize_option = ({ name, value }) => {
  if (value === undefined) return `${ name } `
  if (typeof value === 'string' && value.length > 1)
    return `${ name } "${ value }" `
  if (Array.isArray(value)) {
    const words = value.map(word => `"${ word }"`).join(' ')

    return `${ name } ${ value.length } ${ words } `
  }

  return `${ name } ${ value } `
}
const parse_field = field => ({
  name   : parse_name(field),
  options: field.directives.map(parse_option),
})
const serialize_field = ({ name, options }) =>
  `${ name } ${ options
      .map(serialize_option)
      .join('')
      .trim() } `

export default {
  from_graphql: schema =>
    parse(schema)
        .definitions.map(definition => ({
          index: {
            name   : parse_name(definition),
            options: definition.directives.map(parse_option),
          },
          fields: definition.fields.filter(drop_invalid_field).map(parse_field),
        }))
        .filter(({ fields }) => fields.length),
  from_array_response: ([
    ,
    index_name,
    ,
    index_options,
    ,
    fields, ...rest
  ]) => ({
    index: {
      name   : index_name,
      options: [
        ...rest
            .filter(name => name === 'stopwords_list')
            .map(words => ({
              name : 'STOPWORDS',
              value: words,
            })),
        ...index_options.map(name => ({ name })),
      ],
    },
    fields: fields.map(([field_name, , ...field_options]) => ({
      name   : field_name,
      options: [...extract_multipart_options(field_options)],
    })),
  }),
  to_query: ast => {
    const {
      index: { name: index_name, options: index_options },
      fields,
    } = ast
    const options = index_options.map(serialize_option).join('')
    const serialized_fields = fields
        .map(serialize_field)
        .join('')
        .trim()

    return `FT.CREATE ${ index_name } ${ options }SCHEMA ${ serialized_fields }`
  },
}

// ast = {
//   index: {
//     name   : '',
//     options: [{
//       name : '',
//       value: '',
//     },
//     ],
//   },
//   fields: [{
//     name   : '',
//     options: [{
//       name : '',
//       value: '',
//     },
//     ],
//   }],
// }
