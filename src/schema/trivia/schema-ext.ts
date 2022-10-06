import { Infer, integer, object } from "superstruct"
import extendGraphQLType from "../../lib/extendGraphQLType.js"
import gqlResolver, { gqlArray, gqlInteger, gqlType } from "../../lib/gqlResolver.js"
import { EQ, sql } from "../../lib/querybuilder.js"
import superstructToGraphQL from "../../lib/superstructToGraphQL.js"
import assertAuth from "../assertAuth.js"
import { Complexity } from "../graphql-complexity.js"
import type { SchemaContext, SchemaFields } from "../schema.js"
import { TriviaCategoryGraphQL, TriviaCategorySQL } from "./category.js"
import { N2MTriviaQuestionTriviaCategorySQL, TriviaQuestionGraphQL, TriviaQuestionSQL } from "./question.js"
import { TriviaReportGraphQL, TriviaReportSQL } from "./report.js"

export const TriviaCountsSchema = object({
  questions: integer(),
  questionsNotVerified: integer(),
  // questionsNotAssigned: integer(),
  // questionsReported: integer(),
  categories: integer(),
  categoriesNotVerified: integer(),
  reports: integer(),
})

export const [
  TriviaCountsGraphQL,
] = superstructToGraphQL(TriviaCountsSchema, {
  name: "TriviaCounts",
  fields: {},
})

export type TriviaCounts = Infer<typeof TriviaCountsSchema>

export const triviaSchemaExtensionResolver: SchemaFields = {
  query: {
    triviaCounts: gqlResolver({
      type: gqlType(TriviaCountsGraphQL),
      resolve: async (self, args, ctx) => {
        await assertAuth(ctx, ["trivia/admin"])

        return await ctx.db
          .select([
            [sql`SELECT count(*) FROM ${TriviaQuestionSQL} WHERE ${TriviaQuestionSQL.schema.disabled} = false`, "questions"],
            [sql`SELECT count(*) FROM ${TriviaQuestionSQL} WHERE ${TriviaQuestionSQL.schema.disabled} = false AND ${TriviaQuestionSQL.schema.verified} = false`, "questionsNotVerified"],
            [sql`SELECT count(*) FROM ${TriviaCategorySQL} WHERE ${TriviaCategorySQL.schema.disabled} = false`, "categories"],
            [sql`SELECT count(*) FROM ${TriviaCategorySQL} WHERE ${TriviaCategorySQL.schema.disabled} = false AND ${TriviaCategorySQL.schema.verified} = false`, "categoriesNotVerified"],
            [sql`SELECT count(*) FROM ${TriviaReportSQL}`, "reports"],
          ])
          .findOne<any>()
      },
      description: "requires role: trivia/admin",
      extensions: {
        complexity: Complexity.SIMPLE_QUERY,
      },
    }),
  },

  extend: schema => {
    schema = extendGraphQLType(schema, TriviaCategoryGraphQL, {
      questionsCount: gqlResolver({
        type: gqlInteger(),
        resolve: async (self, args, ctx: SchemaContext) => {
          await assertAuth(ctx, ["trivia/admin"])

          const result = await ctx.db.of(N2MTriviaQuestionTriviaCategorySQL)
            .count(EQ(N2MTriviaQuestionTriviaCategorySQL.schema.categoryId, self.id))
          return result
        },
        description: "requires role: trivia/admin",
        extensions: {
          complexity: Complexity.VIRTUAL_FIELD,
        },
      }),
    })

    schema = extendGraphQLType(schema, TriviaQuestionGraphQL, {
      reportsCount: gqlResolver({
        type: gqlInteger(),
        resolve: async (self, args, ctx: SchemaContext) => {
          await assertAuth(ctx, ["trivia/admin"])

          const result = await ctx.db.of(TriviaReportSQL)
            .count(EQ(TriviaReportSQL.schema.questionId, self.id))
          return result
        },
        description: "requires role: trivia/admin",
        extensions: {
          complexity: Complexity.VIRTUAL_FIELD,
        },
      }),
      reports: gqlResolver({
        type: gqlArray(gqlType(TriviaReportGraphQL)),
        resolve: async (self, args, ctx: SchemaContext) => {
          await assertAuth(ctx, ["trivia/admin"])

          const result = await ctx.db.of(TriviaReportSQL)
            .findMany(EQ(TriviaReportSQL.schema.questionId, self.id))
          return result
        },
        description: "requires role: trivia/admin",
        extensions: {
          complexity: Complexity.PAGINATION,
        },
      }),
    })

    return schema
  },
}
