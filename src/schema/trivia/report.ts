import { Infer, nullable, object, optional, size, string } from "superstruct"
import gqlResolver, { gqlArray, gqlNullable, gqlString, gqlType, gqlUnset } from "../../lib/gqlResolver.js"
import { sql } from "../../lib/querybuilder.js"
import superstructToGraphQL from "../../lib/superstructToGraphQL.js"
import superstructToSQL from "../../lib/superstructToSQL.js"
import assertAuth from "../assertAuth.js"
import assertInput from "../assertInput.js"
import { Complexity } from "../graphql-complexity.js"
import type { SchemaContext, SchemaFields } from "../schema.js"
import { TriviaQuestionGraphQL, TriviaQuestionSchema, TriviaQuestionSQL } from "./question.js"

export const TriviaReportSchema = object({
  id: optional(nullable(string())),
  questionId: string(),
  question: TriviaQuestionSchema,
  message: size(string(), 1, 256),
  submitter: size(string(), 1, 64),
  createdAt: optional(nullable(string())),
})

export const [
  TriviaReportGraphQL,
  TriviaReportGraphQLInput,
] = superstructToGraphQL<SchemaContext>()(TriviaReportSchema, {
  name: "TriviaReport",
  fields: () => ({
    question: gqlResolver({
      type: gqlType(TriviaQuestionGraphQL),
      resolve: async (self: TriviaReport, args, ctx: SchemaContext) => {
        const result = await ctx.db.of(TriviaQuestionSQL)
          .findOneById(self.questionId)
        return result!
      },
    }),
  }),
  inputFields: {
    questionId: { type: gqlUnset() },
    createdAt: { type: gqlUnset() },
  },
})

export const [
  TriviaReportSQL,
] = superstructToSQL(TriviaReportSchema, {
  name: "TriviaReport",
})

export type TriviaReport = Infer<typeof TriviaReportSchema>

export const triviaReportResolver: SchemaFields = {
  query: {
    triviaReport: gqlResolver({
      type: gqlNullable(gqlType(TriviaReportGraphQL)),
      args: {
        id: {
          type: gqlString(),
        },
      },
      resolve: async (self, { id }, ctx) => {
        await assertAuth(ctx, ["trivia/admin"])

        const result = await ctx.db.of(TriviaReportSQL)
          .findOneById(id)
        return result
      },
      description: "requires role: trivia/admin",
      extensions: {
        complexity: Complexity.SIMPLE_QUERY,
      },
    }),
    triviaReports: gqlResolver({
      type: gqlArray(gqlType(TriviaReportGraphQL)),
      args: {
        questionId: {
          type: gqlNullable(gqlString()),
        },
      },
      resolve: async (self, args, ctx) => {
        await assertAuth(ctx, ["trivia/admin"])

        const result = await ctx.db
          .select(TriviaReportSQL)
          .from(TriviaReportSQL)
          .where(!!args.questionId && sql`${TriviaReportSQL.schema.questionId} = ${args.questionId}`)
          .findMany(TriviaReportSQL)
        return result
      },
      description: "requires role: trivia/admin",
      extensions: {
        complexity: Complexity.PAGINATION,
      },
    }),
  },
  mutation: {
    saveTriviaReport: gqlResolver({
      type: gqlType(TriviaReportGraphQL),
      args: {
        input: {
          type: gqlType(TriviaReportGraphQLInput),
        },
      },
      resolve: async (self, { input }, ctx) => {
        if (input.id) {
          throw new Error("trivia reports are immutable")
        }

        input.questionId = input.question.id!

        assertInput(TriviaReportSchema, input)

        const [result] = await ctx.db.of(TriviaReportSQL)
          .save(input)
        return result
      },
      extensions: {
        complexity: Complexity.MUTATION,
      },
    }),
  },
}
