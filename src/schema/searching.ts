import { GraphQLEnumType } from "graphql"
import { gqlNullable, gqlString, InferedGraphQLFieldConfigArgumentMap } from "../lib/gqlResolver.js"
import { Selector, sql, SQLEntity, SqlField } from "../lib/querybuilder.js"
import { sanitizeWebSearch } from "../lib/sqlite-sanitizewebsearch.js"

const GraphQLSortDirection = new GraphQLEnumType({
  name: "SortDirection",
  values: {
    ASC: {},
    DESC: {},
  },
})

export const gqlSortArgs = {
  sortBy: {
    type: gqlNullable(gqlString()),
  },
  sortDir: {
    type: GraphQLSortDirection,
  },
}

export type GraphQLSortArgs = InferedGraphQLFieldConfigArgumentMap<typeof gqlSortArgs>

export const applySortToQuery = (query: Selector, table: SQLEntity, args: GraphQLSortArgs) => {
  if (args.sortBy) {
    if (!Object.keys(table.schema).includes(args.sortBy)) {
      throw new Error(`Sorting only allowed on ${table}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!["ASC", "DESC"].includes(args.sortDir as any)) {
      throw new Error(`Invalid SortDirection: ${args.sortDir}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query.orderBy(new SqlField(args.sortBy, table.entityName), args.sortDir as any)
  }
}

export const gqlSearchArgs = {
  search: {
    type: gqlNullable(gqlString()),
  },
}

export type GraphQLSearchArgs = InferedGraphQLFieldConfigArgumentMap<typeof gqlSearchArgs>

export const applySearchToQuery = (query: Selector, table: SQLEntity, args: GraphQLSearchArgs, ftsTable: SQLEntity) => {
  if (args.search) {
    query
      .join(ftsTable).on(sql`${ftsTable}.rowid = ${table}.rowid`)
      .where(sql`${ftsTable} MATCH ${sanitizeWebSearch(args.search)}`)
      .orderBy(`${ftsTable}.rank`, "ASC")
  }
}
