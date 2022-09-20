import { GraphQLNonNull, GraphQLObjectType, GraphQLType } from "graphql"
import { gqlArray, gqlInteger, gqlNullable, InferedGraphQLFieldConfigArgumentMap } from "../lib/gqlResolver.js"
import { Selector, SQLEntity } from "../lib/querybuilder.js"

const knownPaginationTypes = new Map<GraphQLType, GraphQLObjectType>()

export const gqlPagination = <T extends GraphQLObjectType>(ofType: GraphQLNonNull<T>) => {
  let existing = knownPaginationTypes.get(ofType)
  if (!existing) {
    existing = new GraphQLObjectType({
      name: `${ofType.ofType.name}sConnection`,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const findManyPaginated = async <T extends Record<string, any>>(table: SQLEntity<T>, args: GraphQLPaginationArgs | null | undefined, selector: () => Selector) => {
  const count = await selector()
    .count() ?? 0
  const slice = await selector()
    .offset(args?.offset)
    .limit(args?.limit)
    .findMany(table)

  return {
    slice,
    pageIndex: Math.floor((args?.offset ?? 0) / (args?.limit ?? 1)),
    pageCount: Math.ceil(count / (args?.limit ?? 1)),
  }
}
