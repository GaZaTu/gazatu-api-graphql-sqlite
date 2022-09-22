import extendGraphQLType from "../../lib/extendGraphQLType.js"
import { gqlArray, gqlInteger, gqlType } from "../../lib/gqlResolver.js"
import { EQ } from "../../lib/querybuilder.js"
import assertAuth from "../assertAuth.js"
import { Complexity } from "../graphql-complexity.js"
import type { SchemaContext, SchemaFields } from "../schema.js"
import { TriviaCategoryGraphQL } from "./category.js"
import { N2MTriviaQuestionTriviaCategorySQL, TriviaQuestionGraphQL } from "./question.js"
import { TriviaReportGraphQL, TriviaReportSQL } from "./report.js"

export const triviaExtensionsResolver: SchemaFields = {
  extend: schema => {
    schema = extendGraphQLType(schema, TriviaCategoryGraphQL, {
      questionsCount: {
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
      },
    })

    schema = extendGraphQLType(schema, TriviaQuestionGraphQL, {
      reportsCount: {
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
      },
      reports: {
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
      },
    })

    return schema
  },
}
