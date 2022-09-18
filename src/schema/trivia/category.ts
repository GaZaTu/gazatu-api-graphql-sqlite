import { boolean, Infer, nullable, object, optional, size, string } from "superstruct"
import gqlResolver, { gqlArray, gqlNullable, gqlString, gqlType, gqlUnset } from "../../lib/gqlResolver.js"
import { Complexity } from "../../lib/graphql-complexity.js"
import superstructToGraphQL from "../../lib/superstructToGraphQL.js"
import superstructToSQL from "../../lib/superstructToSQL.js"
import assertAuth from "../assertAuth.js"
import assertInput from "../assertInput.js"
import type { SchemaContext, SchemaFields } from "../schema.js"

export const TriviaCategorySchema = object({
  id: optional(nullable(string())),
  name: size(string(), 1, 32),
  description: optional(nullable(size(string(), 1, 256))),
  submitter: optional(nullable(size(string(), 1, 64))),
  verified: optional(nullable(boolean())),
  disabled: optional(nullable(boolean())),
  createdAt: optional(nullable(string())),
  updatedAt: optional(nullable(string())),
})

export const [
  TriviaCategoryGraphQL,
  TriviaCategoryGraphQLInput,
] = superstructToGraphQL<SchemaContext>()(TriviaCategorySchema, {
  name: "TriviaCategory",
  fields: {},
  inputFields: {
    verified: { type: gqlUnset() },
    disabled: { type: gqlUnset() },
    createdAt: { type: gqlUnset() },
    updatedAt: { type: gqlUnset() },
  },
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
      resolve: async (self, { id }, ctx) => {
        const result = await ctx.db.of(TriviaCategorySQL)
          .findOneById(id)
        return result
      },
      extensions: {
        complexity: Complexity.SIMPLE_QUERY,
      },
    }),
    triviaCategories: gqlResolver({
      type: gqlArray(gqlType(TriviaCategoryGraphQL)),
      resolve: async (self, args, ctx) => {
        const result = await ctx.db.of(TriviaCategorySQL)
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
        input: {
          type: gqlType(TriviaCategoryGraphQLInput),
        },
      },
      resolve: async (self, { input }, ctx) => {
        if (input.id) {
          await assertAuth(ctx, ["trivia/admin"])
        }

        assertInput(TriviaCategorySchema, input)

        const [result] = await ctx.db.of(TriviaCategorySQL)
          .save(input)
        return result
      },
      extensions: {
        complexity: Complexity.MUTATION,
      },
    }),
  },
}
