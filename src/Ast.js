import { parse } from 'graphql/index.mjs'

const FIELD_TYPES = new Set(['TEXT', 'NUMERIC', 'GEO', 'TAG'])
const parse_name = ({ name: { value } }) => value
const drop_invalid_field = ({ directives }) =>
  directives.length && FIELD_TYPES.has(parse_name(directives[0]))
const Option = {
  parse: directive => {
    const [option_value] = directive.arguments.map(argument => {
      const {
        value: { kind: argument_type, value, values },
      } = argument

      if (argument_type === 'ListValue') return values.map(_ => _.value)
      if (argument_type === 'StringValue') return value
      return +value
    })

    return {
      name: parse_name(directive),
      ...option_value && { value: option_value },
    }
  },
  serialize: ({ name, value }) => {
    if (value === undefined) return [name]
    if (Array.isArray(value)) return [name, value.length, value]
    return [name, value]
  },
}
const Field = {
  parse: field => ({
    name   : parse_name(field),
    options: field.directives.map(Option.parse),
  }),
  serialize: ({ name, options }) => [name, options.map(Option.serialize)],
}

export default {
  parse: schema =>
    parse(schema)
        .definitions.filter(({ kind }) => kind === 'ObjectTypeDefinition')
        .map(definition => ({
          index: {
            name   : parse_name(definition),
            options: definition.directives.map(Option.parse),
          },
          fields: definition.fields.filter(drop_invalid_field).map(Field.parse),
        }))
        .filter(({ fields }) => fields.length),
  serialize: ast => {
    const {
      index: { name: index_name, options: index_options },
      fields,
    } = ast

    return [
      'FT.CREATE',
      index_name,
      index_options.map(Option.serialize),
      'SCHEMA',
      ...fields.map(Field.serialize),
    ].flat(Infinity)
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
