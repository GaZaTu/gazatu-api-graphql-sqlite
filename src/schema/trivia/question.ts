import { array, boolean, Infer, nullable, object, optional, size, string } from "superstruct"
import { ulid } from "ulid"
import gqlResolver, { gqlArgsInput, gqlArray, gqlBoolean, gqlNullable, gqlString, gqlType, gqlUnset, gqlVoid } from "../../lib/gqlResolver.js"
import { Complexity } from "../graphql-complexity.js"
import { ASSIGN, sql } from "../../lib/querybuilder.js"
import superstructToGraphQL from "../../lib/superstructToGraphQL.js"
import superstructToSQL from "../../lib/superstructToSQL.js"
import assertAuth from "../assertAuth.js"
import assertInput from "../assertInput.js"
import getN2MDataLoaderFromContext from "../getN2MDataLoaderFromContext.js"
import { findManyPaginated, gqlPagination, gqlPaginationArgs } from "../pagination.js"
import type { SchemaContext, SchemaFields } from "../schema.js"
import { applySearchToQuery, applySortToQuery, gqlSearchArgs, gqlSortArgs } from "../searching.js"
import { TriviaCategoryGraphQL, TriviaCategorySchema, TriviaCategorySQL } from "./category.js"
import { triviaSSEOTPSet } from "./triviaRouter.js"

const triviaQuestionCategoriesDataLoader = Symbol()

export const TriviaQuestionSchema = object({
  id: optional(nullable(string())),
  categories: size(array(TriviaCategorySchema), 1, 5),
  question: size(string(), 1, 256),
  answer: size(string(), 1, 64),
  hint1: optional(nullable(size(string(), 1, 256))),
  hint2: optional(nullable(size(string(), 1, 256))),
  submitter: optional(nullable(size(string(), 1, 64))),
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
      resolve: async (self, { id }, ctx) => {
        const result = await ctx.db.of(TriviaQuestionSQL)
          .findOneById(id)
        return result
      },
      extensions: {
        complexity: Complexity.SIMPLE_QUERY,
      },
    }),
    triviaQuestionsConnection: gqlResolver({
      type: gqlPagination(gqlType(TriviaQuestionGraphQL)),
      args: gqlArgsInput("TriviaQuestionsConnectionArgs", {
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
        categoryId: {
          type: gqlNullable(gqlString()),
          defaultValue: null,
        },
      }),
      resolve: async (self, { args }, ctx) => {
        const result = await findManyPaginated(TriviaQuestionSQL, args, () => {
          const query = ctx.db
            .select(TriviaQuestionSQL)
            .from(TriviaQuestionSQL)
            .where((typeof args?.verified === "boolean") && sql`${TriviaQuestionSQL.schema.verified} = ${args.verified}`)
            .where((typeof args?.disabled === "boolean") && sql`${TriviaQuestionSQL.schema.disabled} = ${args.disabled}`)

          if (args?.categoryId) {
            query.whereIn(TriviaQuestionSQL.schema.id, sub => sub
              .select([N2MTriviaQuestionTriviaCategorySQL.schema.questionId])
              .from(N2MTriviaQuestionTriviaCategorySQL)
              .where(sql`${N2MTriviaQuestionTriviaCategorySQL.schema.categoryId} = ${args.categoryId}`)
            )
          }

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
      resolve: async (self, { input: _input }, ctx) => {
        if (_input.id) {
          await assertAuth(ctx, ["trivia/admin"])
        }

        assertInput(TriviaQuestionSchema, _input)

        const {
          categories,
          ...input
        } = _input

        const [result] = await ctx.db.of(TriviaQuestionSQL)
          .save(input)

        await ctx.db.of(N2MTriviaQuestionTriviaCategorySQL)
          .removeMany(sql`${N2MTriviaQuestionTriviaCategorySQL.schema.questionId} = ${result.id}`)

        for (const category of categories) {
          await ctx.db.of(N2MTriviaQuestionTriviaCategorySQL)
            .save({
              questionId: result.id!,
              categoryId: category.id!,
            })
        }

        await ctx.db.of(TriviaQuestionSQL)
          .save(result)

        return result
      },
      description: "requires role: trivia/admin",
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
      resolve: async (self, { ids }, ctx) => {
        await assertAuth(ctx, ["trivia/admin"])

        await ctx.db.of(TriviaQuestionSQL)
          .updateManyById(ASSIGN(TriviaQuestionSQL.schema.verified, true), ids)
      },
      description: "requires role: trivia/admin",
    }),
    disableTriviaQuestions: gqlResolver({
      type: gqlVoid(),
      args: {
        ids: {
          type: gqlArray(gqlString()),
        },
      },
      resolve: async (self, { ids }, ctx) => {
        await assertAuth(ctx, ["trivia/admin"])

        await ctx.db.of(TriviaQuestionSQL)
          .updateManyById(ASSIGN(TriviaQuestionSQL.schema.disabled, true), ids)
      },
      description: "requires role: trivia/admin",
    }),
  },
  subscription: {
    triviaSSE: gqlResolver({
      type: gqlString(),
      resolve: async (self, args, ctx) => {
        await assertAuth(ctx, ["trivia/admin"])

        const otp = ulid()

        triviaSSEOTPSet.add(otp)
        setTimeout(() => triviaSSEOTPSet.delete(otp), 10000)

        return otp
      },
      description: "requires role: trivia/admin",
    }),
  },
}
