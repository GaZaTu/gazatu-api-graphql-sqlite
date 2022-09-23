import { Infer, nullable, object, optional, size, string } from "superstruct"
import gqlResolver, { gqlArray, gqlNullable, gqlString, gqlType, gqlUnset, gqlVoid } from "../../lib/gqlResolver.js"
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
] = superstructToGraphQL(TriviaReportSchema, {
  name: "TriviaReport",
  fields: {
    questionId: gqlUnset(),
    question: gqlResolver({
      type: gqlType(TriviaQuestionGraphQL),
      resolve: async (self, args, ctx: SchemaContext) => {
        const result = await ctx.db.of(TriviaQuestionSQL)
          .findOneById(self.questionId)
        return result!
      },
    }),
  },
  inputUnset: [
    "createdAt",
  ],
})

export const [
  TriviaReportSQL,
] = superstructToSQL(TriviaReportSchema, {
  name: "TriviaReport",
})

export type TriviaReport = Infer<typeof TriviaReportSchema>

export const triviaReportResolver: SchemaFields = {
  query: {
    triviaReportById: gqlResolver({
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
    triviaReportList: gqlResolver({
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
    triviaReportSave: gqlResolver({
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
    triviaReportRemoveById: gqlResolver({
      type: gqlVoid(),
      args: {
        ids: {
          type: gqlArray(gqlString()),
        },
      },
      resolve: async (self, { ids }, ctx) => {
        await assertAuth(ctx, ["trivia/admin"])

        await ctx.db.of(TriviaReportSQL)
          .removeManyById(ids)
      },
      description: "requires role: trivia/admin",
      extensions: {
        complexity: Complexity.MUTATION,
      },
    }),
    triviaReportRemoveByQuestionId: gqlResolver({
      type: gqlVoid(),
      args: {
        questionId: {
          type: gqlArray(gqlString()),
        },
      },
      resolve: async (self, { questionId }, ctx) => {
        await assertAuth(ctx, ["trivia/admin"])

        await ctx.db.of(TriviaReportSQL)
          .removeMany(sql`${TriviaReportSQL.schema.questionId} = ${questionId}`)
      },
      description: "requires role: trivia/admin",
      extensions: {
        complexity: Complexity.MUTATION,
      },
    }),
  },
}
