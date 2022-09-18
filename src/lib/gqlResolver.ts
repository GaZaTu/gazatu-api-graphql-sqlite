import { GraphQLBoolean, GraphQLFieldConfig, GraphQLFieldConfigArgumentMap, GraphQLFieldResolver, GraphQLFloat, GraphQLInputObjectType, GraphQLInt, GraphQLInterfaceType, GraphQLList, GraphQLNonNull, GraphQLNullableType, GraphQLObjectType, GraphQLOutputType, GraphQLScalarType, GraphQLString, GraphQLType } from "graphql"
import { Struct } from "superstruct"

export type InferGraphQLType<O> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  O extends { struct: Struct<infer T, any> }
    ? T | null | undefined
    : O extends GraphQLScalarType<infer T>
      ? T | null | undefined
      : O extends GraphQLInterfaceType
        ? Record<string, unknown> | null | undefined
        : O extends GraphQLInputObjectType
          ? Record<string, unknown> | null | undefined
          : O extends GraphQLObjectType<infer T>
            ? T | null | undefined
            : O extends GraphQLNonNull<infer T> & { wrapper: "nonnull" }
              ? Exclude<InferGraphQLType<T>, null | undefined>
              : O extends GraphQLList<infer T> & { wrapper: "list" }
                ? Array<InferGraphQLType<T>> | null | undefined
                : unknown

export type InferedGraphQLFieldResolver<T, C, A, O extends GraphQLOutputType> = GraphQLFieldResolver<T, C, A, InferGraphQLType<O> | Promise<InferGraphQLType<O>>>

export type InferedGraphQLFieldConfigArgumentMap<A extends GraphQLFieldConfigArgumentMap> = {
  [P in keyof A]: InferGraphQLType<A[P]["type"]>
}

function gqlResolver<T, C, A extends GraphQLFieldConfigArgumentMap, O extends GraphQLOutputType>(config: Omit<GraphQLFieldConfig<T, C>, "type" | "resolve"> & { type: O, args?: A, resolve: InferedGraphQLFieldResolver<T, C, InferedGraphQLFieldConfigArgumentMap<A>, O> }) {
  return config
}

export default gqlResolver

export const gqlType = <T extends GraphQLNullableType>(ofType: T) =>
  Object.assign(new GraphQLNonNull(ofType), { wrapper: "nonnull" as const })

export const gqlString = () =>
  gqlType(GraphQLString)

export const gqlInteger = () =>
  gqlType(GraphQLInt)

export const gqlNumber = () =>
  gqlType(GraphQLFloat)

export const gqlBoolean = () =>
  gqlType(GraphQLBoolean)

export const gqlArray = <T extends GraphQLType>(ofType: T) =>
  gqlType(Object.assign(new GraphQLList(ofType), { wrapper: "list" as const }))

export const gqlNullable = <T extends GraphQLNullableType>(nonnull: GraphQLNonNull<T>) =>
  nonnull.ofType

const GraphQLVoid = new GraphQLScalarType<void>({
  name: "Void",
  parseLiteral: () => undefined,
  parseValue: () => undefined,
  serialize: () => undefined,
})

export const gqlVoid = () =>
  GraphQLVoid

const GraphQLUnknown = new GraphQLScalarType({
  name: "Unknown",
})

export const gqlUnknown = () =>
  GraphQLUnknown

const GraphQLUnset = new GraphQLScalarType({
  name: "Unset",
  parseLiteral: () => undefined,
  parseValue: () => undefined,
  serialize: () => undefined,
})

export const gqlUnset = () =>
  GraphQLUnset
