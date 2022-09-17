import { boolean, Infer, nullable, object, optional, string } from "superstruct"
import gqlResolver, { gqlArray, gqlNullable, gqlString, gqlType, gqlUnknown } from "../../lib/gqlResolver.js"
import { COMPLEXITY_MUTATION, COMPLEXITY_PAGINATION, COMPLEXITY_SIMPLE_QUERY, COMPLEXITY_VIRTUAL_FIELD } from "../../lib/graphql-complexity.js"
import superstructToGraphQL from "../../lib/superstructToGraphQL.js"
import superstructToSQL from "../../lib/superstructToSQL.js"
import { SchemaContext, SchemaFields } from "../index.js"
import { TriviaCategoryGraphQL, TriviaCategorySchema, TriviaCategorySQL } from "./category.js"

export const TriviaQuestionSchema = object({
  id: optional(nullable(string())),
  categoryId: string(),
  category: TriviaCategorySchema,
  question: string(),
  answer: string(),
  hint1: optional(nullable(string())),
  hint2: optional(nullable(string())),
  submitter: optional(nullable(string())),
  verified: optional(nullable(boolean())),
  disabled: optional(nullable(boolean())),
})

export const [
  TriviaQuestionGraphQL,
  TriviaQuestionGraphQLInput,
] = superstructToGraphQL<SchemaContext>()(TriviaQuestionSchema, {
  name: "TriviaQuestion",
  fields: {
    categoryId: { type: gqlUnknown() },
    category: gqlResolver({
      type: gqlType(TriviaCategoryGraphQL),
      resolve: async (self, args, { db }) => {
        const result = await db.of(TriviaCategorySQL)
          .findOneById(self.categoryId)
        return result!
      },
      extensions: {
        complexity: COMPLEXITY_VIRTUAL_FIELD,
      },
    }),
  },
})

export const [
  TriviaQuestionSQL,
] = superstructToSQL(TriviaQuestionSchema, {
  name: "TriviaQuestion",
})

export type TriviaQuestion = Infer<typeof TriviaQuestionSchema>

export const triviaQuestionResolver: SchemaFields = {
  query: {
    triviaQuestion: gqlResolver({
      type: gqlNullable(gqlType(TriviaQuestionGraphQL)),
      args: {
        id: {
          type: gqlString(),
        },
      },
      resolve: async (self, { id }, { db }) => {
        const result = await db.of(TriviaQuestionSQL)
          .findOneById(id)
        return result
      },
      extensions: {
        complexity: COMPLEXITY_SIMPLE_QUERY,
      },
    }),
    triviaQuestions: gqlResolver({
      type: gqlArray(gqlType(TriviaQuestionGraphQL)),
      resolve: async (self, args, { db }) => {
        const result = await db.of(TriviaQuestionSQL)
          .findMany()
        return result
      },
      extensions: {
        complexity: COMPLEXITY_PAGINATION,
      },
    }),
  },
  mutation: {
    saveTriviaQuestion: gqlResolver({
      type: gqlType(TriviaQuestionGraphQL),
      args: {
        input: { type: gqlType(TriviaQuestionGraphQLInput) },
      },
      resolve: async (_, { input: _input }, { db }) => {
        const {
          category,
          ...input
        } = _input

        input.categoryId = category.id!

        const [result] = await db.of(TriviaQuestionSQL)
          .save(input)
        return result
      },
      extensions: {
        complexity: COMPLEXITY_MUTATION,
      },
    }),
  },
}
