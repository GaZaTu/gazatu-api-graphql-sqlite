import { GraphQLNonNull, GraphQLObjectType, GraphQLType } from "graphql"
import { gqlArray, gqlInteger, gqlNullable, InferedGraphQLFieldConfigArgumentMap } from "../lib/gqlResolver.js"
import { Selector, SQLEntity } from "../lib/querybuilder.js"

const knownPaginationTypes = new Map<GraphQLType, GraphQLObjectType>()

export const gqlPagination = <T extends GraphQLObjectType>(ofType: GraphQLNonNull<T>) => {
  let existing = knownPaginationTypes.get(ofType)
  if (!existing) {
    existing = new GraphQLObjectType({
      name: `${ofType.ofType.name}ListConnection`,
      fields: {
        slice: {
          type: gqlArray(ofType),
        },
        pageIndex: {
          type: gqlInteger(),
        },
        pageCount: {
          type: gqlInteger(),
        },
      },
    })
    knownPaginationTypes.set(ofType, existing)
  }

  return existing as GraphQLObjectType<{
    slice: (T extends GraphQLObjectType<infer S> ? S : never)[],
    pageIndex: number,
    pageCount: number,
  }>
}

export const gqlPaginationArgs = {
  offset: {
    type: gqlNullable(gqlInteger()),
    defaultValue: 0,
  },
  limit: {
    type: gqlNullable(gqlInteger()),
    defaultValue: 25,
  },
}

export type GraphQLPaginationArgs = InferedGraphQLFieldConfigArgumentMap<typeof gqlPaginationArgs>

export const findManyPaginated = async <T extends Record<string, any>>(query: Selector, args: GraphQLPaginationArgs | null | undefined, constructor: SQLEntity<T> | undefined) => {
  const slice = await query
    .offset(args?.offset)
    .limit(args?.limit)
    .findMany(constructor)

  const count = await query
    .offset(undefined)
    .limit(undefined)
    .count() ?? 0

  return {
    slice,
    pageIndex: Math.floor((args?.offset ?? 0) / (args?.limit ?? 1)),
    pageCount: Math.ceil(count / (args?.limit ?? 1)),
  }
}
