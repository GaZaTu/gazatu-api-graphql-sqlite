import { GraphQLEnumType, GraphQLInputObjectType } from "graphql"
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

const GraphQLOrderBy = new GraphQLInputObjectType({
  name: "OrderBy",
  fields: {
    col: {
      type: gqlString(),
    },
    dir: {
      type: GraphQLSortDirection,
    },
  },
})

export const gqlSortArgs = {
  orderBy: {
    type: GraphQLOrderBy,
  },
}

export type GraphQLSortArgs = InferedGraphQLFieldConfigArgumentMap<typeof gqlSortArgs>

export const applySortToQuery = (query: Selector, table: SQLEntity, args: GraphQLSortArgs | null | undefined) => {
  if (!args?.orderBy) {
    return
  }

  const {
    col,
    dir = "ASC",
  } = args.orderBy

  if (!table.schema[col as string]) {
    throw new Error(`Sorting only allowed on ${table}`)
  }

  if (!["ASC", "DESC"].includes(dir as string)) {
    throw new Error(`Invalid SortDirection: ${dir}`)
  }

  query.orderBy(new SqlField(col as string, table.entityName), dir as any)
}

export const gqlSearchArgs = {
  search: {
    type: gqlNullable(gqlString()),
  },
}

export type GraphQLSearchArgs = InferedGraphQLFieldConfigArgumentMap<typeof gqlSearchArgs>

export const applySearchToQuery = (query: Selector, table: SQLEntity, args: GraphQLSearchArgs | null | undefined, ftsTable: SQLEntity) => {
  if (!args?.search) {
    return
  }

  query
    .join(ftsTable).on(sql`${ftsTable}.rowid = ${table}.rowid`)
    .where(sql`${ftsTable} MATCH ${sanitizeWebSearch(args.search)}`)
    .orderBy(`${ftsTable}.rank`, "ASC")
}
