import { boolean, Infer, nullable, object, optional, string } from "superstruct"
import gqlResolver, { gqlArray, gqlNullable, gqlString, gqlType } from "../../lib/gqlResolver.js"
import { Complexity } from "../../lib/graphql-complexity.js"
import superstructToGraphQL from "../../lib/superstructToGraphQL.js"
import superstructToSQL from "../../lib/superstructToSQL.js"
import { SchemaContext, SchemaFields } from "../index.js"

export const TriviaCategorySchema = object({
  id: optional(nullable(string())),
  name: string(),
  description: optional(nullable(string())),
  submitter: optional(nullable(string())),
  verified: optional(nullable(boolean())),
  disabled: optional(nullable(boolean())),
})

export const [
  TriviaCategoryGraphQL,
  TriviaCategoryGraphQLInput,
] = superstructToGraphQL<SchemaContext>()(TriviaCategorySchema, {
  name: "TriviaCategory",
  fields: {},
})

export const [
  TriviaCategorySQL,
] = superstructToSQL(TriviaCategorySchema, {
  name: "TriviaCategory",
})

export type TriviaCategory = Infer<typeof TriviaCategorySchema>

export const triviaCategoryResolver: SchemaFields = {
  query: {
    triviaCategory: gqlResolver({
      type: gqlNullable(gqlType(TriviaCategoryGraphQL)),
      args: {
        id: {
          type: gqlString(),
        },
      },
      resolve: async (self, { id }, { db }) => {
        const result = await db.of(TriviaCategorySQL)
          .findOneById(id)
        return result
      },
      extensions: {
        complexity: Complexity.SIMPLE_QUERY,
      },
    }),
    triviaCategories: gqlResolver({
      type: gqlArray(gqlType(TriviaCategoryGraphQL)),
      resolve: async (self, args, { db }) => {
        const result = await db.of(TriviaCategorySQL)
          .findMany()
        return result
      },
      extensions: {
        complexity: Complexity.PAGINATION,
      },
    }),
  },
  mutation: {
    saveTriviaCategory: gqlResolver({
      type: gqlType(TriviaCategoryGraphQL),
      args: {
        input: { type: gqlType(TriviaCategoryGraphQLInput) },
      },
      resolve: async (self, { input }, { db }) => {
        const [result] = await db.of(TriviaCategorySQL)
          .save(input)
        return result
      },
      extensions: {
        complexity: Complexity.MUTATION,
      },
    }),
  },
}
