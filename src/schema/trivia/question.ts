import { array, boolean, Infer, nullable, object, optional, string } from "superstruct"
import gqlResolver, { gqlArray, gqlBoolean, gqlNullable, gqlString, gqlType, gqlUnset, gqlVoid } from "../../lib/gqlResolver.js"
import { Complexity } from "../../lib/graphql-complexity.js"
import { ASSIGN, sql } from "../../lib/querybuilder.js"
import superstructToGraphQL from "../../lib/superstructToGraphQL.js"
import superstructToSQL from "../../lib/superstructToSQL.js"
import getN2MDataLoaderFromContext from "../getN2MDataLoaderFromContext.js"
import { findManyPaginated, gqlPagination, gqlPaginationArgs } from "../pagination.js"
import type { SchemaContext, SchemaFields } from "../schema.js"
import { applySearchToQuery, applySortToQuery, gqlSearchArgs, gqlSortArgs } from "../searching.js"
import { TriviaCategoryGraphQL, TriviaCategorySchema, TriviaCategorySQL } from "./category.js"

const triviaQuestionCategoriesDataLoader = Symbol()

export const TriviaQuestionSchema = object({
  id: optional(nullable(string())),
  categories: array(TriviaCategorySchema),
  question: string(),
  answer: string(),
  hint1: optional(nullable(string())),
  hint2: optional(nullable(string())),
  submitter: optional(nullable(string())),
  verified: optional(nullable(boolean())),
  disabled: optional(nullable(boolean())),
  createdAt: optional(nullable(string())),
  updatedAt: optional(nullable(string())),
})

export const [
  TriviaQuestionGraphQL,
  TriviaQuestionGraphQLInput,
] = superstructToGraphQL<SchemaContext>()(TriviaQuestionSchema, {
  name: "TriviaQuestion",
  fields: {
    categories: gqlResolver({
      type: gqlArray(gqlType(TriviaCategoryGraphQL)),
      resolve: async (self, args, ctx) => {
        const dataloader = getN2MDataLoaderFromContext(ctx, triviaQuestionCategoriesDataLoader, TriviaCategorySQL, N2MTriviaQuestionTriviaCategorySQL, "questionId", "categoryId")

        const result = await dataloader.load(self.id!)
        return result
      },
      extensions: {
        complexity: Complexity.VIRTUAL_FIELD,
      },
    }),
  },
  inputFields: {
    verified: { type: gqlUnset() },
    disabled: { type: gqlUnset() },
    createdAt: { type: gqlUnset() },
    updatedAt: { type: gqlUnset() },
  },
})

export const [
  TriviaQuestionSQL,
] = superstructToSQL(TriviaQuestionSchema, {
  name: "TriviaQuestion",
})

export type TriviaQuestion = Infer<typeof TriviaQuestionSchema>

export const N2MTriviaQuestionTriviaCategorySchema = object({
  questionId: string(),
  categoryId: string(),
})

export const [
  N2MTriviaQuestionTriviaCategorySQL,
] = superstructToSQL(N2MTriviaQuestionTriviaCategorySchema, {
  name: `N2M_${TriviaQuestionSQL}_${TriviaCategorySQL}`,
})

export const TriviaQuestionFTSSchema = object({
})

export const [
  TriviaQuestionFTSSQL,
] = superstructToSQL(TriviaQuestionFTSSchema, {
  name: `${TriviaQuestionSQL}FTS`,
})

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
        complexity: Complexity.SIMPLE_QUERY,
      },
    }),
    triviaQuestions: gqlResolver({
      type: gqlPagination(gqlType(TriviaQuestionGraphQL)),
      args: {
        ...gqlPaginationArgs,
        ...gqlSortArgs,
        ...gqlSearchArgs,
        verified: {
          type: gqlNullable(gqlBoolean()),
          defaultValue: null,
        },
        disabled: {
          type: gqlNullable(gqlBoolean()),
          defaultValue: false,
        },
      },
      resolve: async (self, args, { db }) => {
        const result = await findManyPaginated(TriviaQuestionSQL, args, () => {
          const query = db
            .select(TriviaQuestionSQL)
            .from(TriviaQuestionSQL)
            .where((typeof args.verified === "boolean") && sql`${TriviaQuestionSQL.schema.verified} = ${args.verified}`)
            .where((typeof args.disabled === "boolean") && sql`${TriviaQuestionSQL.schema.disabled} = ${args.disabled}`)

          applySortToQuery(query, TriviaQuestionSQL, args)
          applySearchToQuery(query, TriviaQuestionSQL, args, TriviaQuestionFTSSQL)

          return query
        })

        return result
      },
      extensions: {
        complexity: Complexity.PAGINATION,
      },
    }),
  },
  mutation: {
    saveTriviaQuestion: gqlResolver({
      type: gqlType(TriviaQuestionGraphQL),
      args: {
        input: {
          type: gqlType(TriviaQuestionGraphQLInput),
        },
      },
      resolve: async (self, { input: _input }, { db }) => {
        const {
          categories,
          ...input
        } = _input

        const [result] = await db.of(TriviaQuestionSQL)
          .save(input)

        await db.of(N2MTriviaQuestionTriviaCategorySQL)
          .removeMany(sql`${N2MTriviaQuestionTriviaCategorySQL.schema.questionId} = ${result.id}`)

        for (const category of categories) {
          await db.of(N2MTriviaQuestionTriviaCategorySQL)
            .save({
              questionId: result.id!,
              categoryId: category.id!,
            })
        }

        await db.of(TriviaQuestionSQL)
          .save(result)

        return result
      },
      extensions: {
        complexity: Complexity.MUTATION,
      },
    }),
    verifyTriviaQuestions: gqlResolver({
      type: gqlVoid(),
      args: {
        ids: {
          type: gqlArray(gqlString()),
        },
      },
      resolve: async (self, { ids }, { db }) => {
        await db.of(TriviaQuestionSQL)
          .updateManyById(ASSIGN(TriviaQuestionSQL.schema.verified, true), ids)
      },
    }),
    disableTriviaQuestions: gqlResolver({
      type: gqlVoid(),
      args: {
        ids: {
          type: gqlArray(gqlString()),
        },
      },
      resolve: async (self, { ids }, { db }) => {
        await db.of(TriviaQuestionSQL)
          .updateManyById(ASSIGN(TriviaQuestionSQL.schema.disabled, true), ids)
      },
    }),
  },
}
