import { GraphQLBoolean, GraphQLFieldConfig, GraphQLFieldConfigMap, GraphQLFloat, GraphQLID, GraphQLInputFieldConfig, GraphQLInputFieldConfigMap, GraphQLInputObjectType, GraphQLInputObjectTypeConfig, GraphQLInt, GraphQLInterfaceType, GraphQLInterfaceTypeConfig, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLObjectTypeConfig, GraphQLString, GraphQLType } from "graphql"
import { Struct } from "superstruct"
import { gqlUnset, GraphQLUnset } from "./gqlResolver.js"
import superstructIsRequired from "./superstructIsRequired.js"

const mappingInput = new Map<Struct<any, any>, GraphQLType>()
const mappingOutput = new Map<Struct<any, any>, GraphQLType>()

export function superstructToGraphQLScalar<T, S>(kind: "input" | "output", struct: Struct<T, S>): readonly [any, T | undefined] {
  const graphqlType = (() => {
    const existing = (kind === "input" ? mappingInput : mappingOutput).get(struct)
    if (existing) {
      return existing as any
    }

    switch (struct.type) {
      case "bigint": return GraphQLID
      case "string": return GraphQLString
      case "integer": return GraphQLInt
      case "number": return GraphQLFloat
      case "boolean": return GraphQLBoolean
      case "array": {
        const [childType] = superstructToGraphQLScalar(kind, struct.schema as any)
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
  const kind = (Type === GraphQLInputObjectType) ? "input" : "output"

  const graphqlType = new Type({
    ...(config as any),
    fields: () => {
      const fields = {} as (Record<string, GraphQLFieldConfig<any, any, any> | GraphQLInputFieldConfig>)

      if (struct.schema) {
        if (typeof struct.schema === "object") {
          for (const [prop, propStruct] of Object.entries(struct.schema)) {
            const [type, defaultValue] = superstructToGraphQLScalar(kind, propStruct)

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

      return Object.entries(fields)
        .reduce((o, [fieldName, fieldConfig]) => {
          if (fieldConfig.type !== GraphQLUnset) {
            o[fieldName] = fieldConfig as GraphQLInputFieldConfig
          }

          return o
        }, {} as GraphQLInputFieldConfigMap)
    },
  })

  void (kind === "input" ? mappingInput : mappingOutput).set(struct, graphqlType)

  return Object.assign(graphqlType, {
    struct,
  })
}

function superstructToGraphQL<T, S>(struct: Struct<T, S>, config: GraphQLObjectTypeConfig<T, any> & { inputFields?: GraphQLInputFieldConfigMap, inputUnset?: (keyof T)[] }) {
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

      Object.assign(fields, config.inputFields)

      Object.assign(fields, Object.fromEntries(
        config.inputUnset?.map(k => [k, gqlUnset()] as const) ?? []
      ))

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

export default superstructToGraphQL
