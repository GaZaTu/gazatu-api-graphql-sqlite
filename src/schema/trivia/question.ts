import DataLoader from "dataloader"
import { array, boolean, Infer, nullable, object, optional, string } from "superstruct"
import gqlResolver, { gqlArray, gqlNullable, gqlString, gqlType } from "../../lib/gqlResolver.js"
import { Complexity } from "../../lib/graphql-complexity.js"
import { sql } from "../../lib/querybuilder.js"
import superstructToGraphQL from "../../lib/superstructToGraphQL.js"
import superstructToSQL from "../../lib/superstructToSQL.js"
import { findManyPaginated, gqlPagination, gqlPaginationArgs } from "../pagination.js"
import type { SchemaContext, SchemaFields } from "../schema.js"
import { applySearchToQuery, applySortToQuery, gqlSearchArgs, gqlSortArgs } from "../searching.js"
import { TriviaCategory, TriviaCategoryGraphQL, TriviaCategorySchema, TriviaCategorySQL } from "./category.js"

const triviaCategoriesDataLoader = Symbol()

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
        const { db } = ctx

        let dataloader = ctx[triviaCategoriesDataLoader] as DataLoader<string, TriviaCategory[]> | undefined
        if (!dataloader) {
          dataloader = new DataLoader(async ids => {
            const n2m = await db
              .select(TriviaCategorySQL)
              .select([N2MTriviaQuestionTriviaCategorySQL.schema.questionId])
              .from(N2MTriviaQuestionTriviaCategorySQL)
              .join(TriviaCategorySQL).on(sql`${TriviaCategorySQL.schema.id} = ${N2MTriviaQuestionTriviaCategorySQL.schema.categoryId}`)
              .where(sql`${N2MTriviaQuestionTriviaCategorySQL.schema.questionId} IN ${ids}`)
              .findMany(TriviaCategorySQL)

            return ids
              .map(id => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return n2m.filter(cat => (cat as any).questionId === id)
              })
          }, { maxBatchSize: 100 })
          ctx[triviaCategoriesDataLoader] = dataloader
        }

        return dataloader.load(self.id!)
      },
      extensions: {
        complexity: Complexity.VIRTUAL_FIELD,
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
      },
      resolve: async (self, args, { db }) => {
        const result = await findManyPaginated(TriviaQuestionSQL, args, () => {
          const query = db
            .select(TriviaQuestionSQL)
            .from(TriviaQuestionSQL)

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
        input: { type: gqlType(TriviaQuestionGraphQLInput) },
      },
      resolve: async (_, { input: _input }, { db }) => {
        const {
          categories,
          ...input
        } = _input

        const [result] = await db.of(TriviaQuestionSQL)
          .save(input)

        for (const category of categories) {
          await db.of(N2MTriviaQuestionTriviaCategorySQL)
            .save({
              questionId: result.id!,
              categoryId: category.id!,
            })
        }

        return result
      },
      extensions: {
        complexity: Complexity.MUTATION,
      },
    }),
  },
}
