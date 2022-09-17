import { GraphQLBoolean, GraphQLFieldConfig, GraphQLFieldConfigMap, GraphQLFloat, GraphQLID, GraphQLInputFieldConfig, GraphQLInputFieldConfigMap, GraphQLInputObjectType, GraphQLInputObjectTypeConfig, GraphQLInt, GraphQLInterfaceType, GraphQLInterfaceTypeConfig, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLObjectTypeConfig, GraphQLString, GraphQLType } from "graphql"
import { Struct } from "superstruct"
import superstructIsRequired from "./superstructIsRequired.js"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapping = new Map<Struct<any, any>, GraphQLType>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function superstructToGraphQLScalar<T, S>(struct: Struct<T, S>): readonly [any, T | undefined] {
  const graphqlType = (() => {
    const existing = mapping.get(struct)
    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return existing as any
    }

    switch (struct.type) {
      case "bigint": return GraphQLID
      case "string": return GraphQLString
      case "integer": return GraphQLInt
      case "number": return GraphQLFloat
      case "boolean": return GraphQLBoolean
      case "array": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [childType] = superstructToGraphQLScalar(struct.schema as any)
        return new GraphQLList(childType)
      }
      default:
        console.error(struct)
        throw new Error(`struct.type ${struct.type}`)
    }
  })()

  const [required, defaultValue] = superstructIsRequired(struct)
  if (required) {
    return [new GraphQLNonNull(graphqlType), defaultValue] as const
  }

  return [graphqlType, defaultValue] as const
}

export function superstructToGraphQLType<T, S, C>(Type: typeof GraphQLObjectType, struct: Struct<T, S>, config: GraphQLObjectTypeConfig<T, C>): GraphQLObjectType<T> & { struct: Struct<T, S> }
export function superstructToGraphQLType<T, S>(Type: typeof GraphQLInputObjectType, struct: Struct<T, S>, config: GraphQLInputObjectTypeConfig): GraphQLInputObjectType & { struct: Struct<T, S> }
export function superstructToGraphQLType<T, S, C>(Type: typeof GraphQLInterfaceType, struct: Struct<T, S>, config: GraphQLInterfaceTypeConfig<T, C>): GraphQLInterfaceType & { struct: Struct<T, S> }
export function superstructToGraphQLType<T, S, C>(Type: (typeof GraphQLObjectType) | (typeof GraphQLInputObjectType) | (typeof GraphQLInterfaceType), struct: Struct<T, S>, config: GraphQLObjectTypeConfig<T, C> | GraphQLInputObjectTypeConfig | GraphQLInterfaceTypeConfig<T, C>): InstanceType<typeof Type> & { struct: Struct<T, S> } {
  const graphqlType = new Type({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(config as any),
    fields: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields = {} as (Record<string, GraphQLFieldConfig<any, any, any> | GraphQLInputFieldConfig>)

      if (struct.schema) {
        if (typeof struct.schema === "object") {
          for (const [prop, propStruct] of Object.entries(struct.schema)) {
            const [type, defaultValue] = superstructToGraphQLScalar(propStruct)

            fields[prop] = {
              type,
              defaultValue,
            }
          }
        }
      }

      if (typeof config.fields === "function") {
        Object.assign(fields, config.fields())
      } else {
        Object.assign(fields, config.fields)
      }

      return fields
    },
  })

  mapping.set(struct, graphqlType)

  return Object.assign(graphqlType, {
    struct,
  })
}

function superstructToGraphQL<C>() {
  function superstructToGraphQL<T, S>(struct: Struct<T, S>, config: GraphQLObjectTypeConfig<T, C>) {
    const ObjectType = superstructToGraphQLType(GraphQLObjectType, struct, {
      ...config,
    })

    const InputType = superstructToGraphQLType(GraphQLInputObjectType, struct, {
      name: `${config.name}Input`,
      fields: () => {
        const fields = {} as GraphQLFieldConfigMap<unknown, unknown>

        if (typeof config.fields === "function") {
          Object.assign(fields, config.fields())
        } else {
          Object.assign(fields, config.fields)
        }

        return Object.entries(fields)
          .reduce((o, [fieldName, fieldConfig]) => {
            if (!fieldConfig.resolve) {
              o[fieldName] = fieldConfig as GraphQLInputFieldConfig
            }

            return o
          }, {} as GraphQLInputFieldConfigMap)
      },
    })

    return [ObjectType, InputType] as const
  }

  return superstructToGraphQL
}

export default superstructToGraphQL
