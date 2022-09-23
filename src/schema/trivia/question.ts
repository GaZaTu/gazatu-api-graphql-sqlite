import { array, boolean, Infer, nullable, object, optional, size, string } from "superstruct"
import { ulid } from "ulid"
import gqlResolver, { gqlArgsInput, gqlArray, gqlBoolean, gqlNullable, gqlString, gqlType, gqlUnset, gqlVoid } from "../../lib/gqlResolver.js"
import { ASSIGN, sql } from "../../lib/querybuilder.js"
import superstructToGraphQL from "../../lib/superstructToGraphQL.js"
import superstructToSQL from "../../lib/superstructToSQL.js"
import assertAuth, { currentUser } from "../assertAuth.js"
import assertInput from "../assertInput.js"
import { getN2MDataLoaderFromContext } from "../getDataLoaderFromContext.js"
import { Complexity } from "../graphql-complexity.js"
import { UserGraphQL, UserSQL } from "../misc/user.js"
import { findManyPaginated, gqlPagination, gqlPaginationArgs } from "../pagination.js"
import type { SchemaContext, SchemaFields } from "../schema.js"
import { applySearchToQuery, applySortToQuery, gqlSearchArgs, gqlSortArgs } from "../searching.js"
import { TriviaCategoryGraphQL, TriviaCategorySchema, TriviaCategorySQL } from "./category.js"

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
  updatedByUserId: optional(nullable(string())),
})

export const [
  TriviaQuestionGraphQL,
  TriviaQuestionGraphQLInput,
] = superstructToGraphQL(TriviaQuestionSchema, {
  name: "TriviaQuestion",
  fields: {
    categories: gqlResolver({
      type: gqlArray(gqlType(TriviaCategoryGraphQL)),
      resolve: async (self, args, ctx: SchemaContext) => {
        const dataloader = getN2MDataLoaderFromContext(ctx, triviaQuestionCategoriesDataLoader, TriviaCategorySQL, N2MTriviaQuestionTriviaCategorySQL, "questionId", "categoryId")

        const result = await dataloader.load(self.id!)
        return result
      },
      extensions: {
        complexity: Complexity.VIRTUAL_FIELD,
      },
    }),
    updatedByUserId: gqlUnset(),
    updatedBy: gqlResolver({
      type: gqlNullable(gqlType(UserGraphQL)),
      resolve: async (self, args, ctx: SchemaContext) => {
        await assertAuth(ctx, ["admin"])

        const result = await ctx.db.of(UserSQL)
          .findOneById(self.updatedByUserId)
        return result
      },
    }),
  },
  inputUnset: [
    "verified",
    "disabled",
    "createdAt",
    "updatedAt",
  ],
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
    triviaQuestionById: gqlResolver({
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
    triviaQuestionListConnection: gqlResolver({
      type: gqlPagination(gqlType(TriviaQuestionGraphQL)),
      args: gqlArgsInput("TriviaQuestionListConnectionArgs", {
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
        shuffled: {
          type: gqlNullable(gqlBoolean()),
          defaultValue: false,
        },
        includeCategories: {
          type: gqlNullable(gqlArray(gqlString())),
        },
        excludeCategories: {
          type: gqlNullable(gqlArray(gqlString())),
        },
        includeSubmitters: {
          type: gqlNullable(gqlArray(gqlString())),
        },
        excludeSubmitters: {
          type: gqlNullable(gqlArray(gqlString())),
        },
        categoryId: {
          type: gqlNullable(gqlString()),
        },
      }),
      resolve: async (self, { args }, ctx) => {
        const query = ctx.db
          .select(TriviaQuestionSQL)
          .from(TriviaQuestionSQL)
          .where((typeof args?.verified === "boolean") && sql`${TriviaQuestionSQL.schema.verified} = ${args.verified}`)
          .where((typeof args?.disabled === "boolean") && sql`${TriviaQuestionSQL.schema.disabled} = ${args.disabled}`)
          .orderBy(!!args?.shuffled && sql`random()`)

        if (args?.includeCategories) {
          query.whereIn(TriviaQuestionSQL.schema.id, sub => sub
            .select([N2MTriviaQuestionTriviaCategorySQL.schema.questionId])
            .from(N2MTriviaQuestionTriviaCategorySQL)
            .join(TriviaCategorySQL).on(sql`${TriviaCategorySQL.schema.id} = ${N2MTriviaQuestionTriviaCategorySQL.schema.categoryId}`)
            .where(sql`${TriviaCategorySQL.schema.name} IN ${args.includeCategories}`)
          )
        }

        if (args?.excludeCategories) {
          query.whereIn(TriviaQuestionSQL.schema.id, sub => sub
            .select([N2MTriviaQuestionTriviaCategorySQL.schema.questionId])
            .from(N2MTriviaQuestionTriviaCategorySQL)
            .join(TriviaCategorySQL).on(sql`${TriviaCategorySQL.schema.id} = ${N2MTriviaQuestionTriviaCategorySQL.schema.categoryId}`)
            .where(sql`${TriviaCategorySQL.schema.name} NOT IN ${args.excludeCategories}`)
          )
        }

        if (args?.includeSubmitters) {
          query.where(sql`${TriviaQuestionSQL.schema.submitter} IN ${args.includeSubmitters}`)
        }

        if (args?.excludeSubmitters) {
          query.where(sql`${TriviaQuestionSQL.schema.submitter} NOT IN ${args.excludeSubmitters}`)
        }

        if (args?.categoryId) {
          query.whereIn(TriviaQuestionSQL.schema.id, sub => sub
            .select([N2MTriviaQuestionTriviaCategorySQL.schema.questionId])
            .from(N2MTriviaQuestionTriviaCategorySQL)
            .where(sql`${N2MTriviaQuestionTriviaCategorySQL.schema.categoryId} = ${args.categoryId}`)
          )
        }

        applySortToQuery(query, TriviaQuestionSQL, args)
        applySearchToQuery(query, TriviaQuestionSQL, args, TriviaQuestionFTSSQL)

        const result = await findManyPaginated(query, args, TriviaQuestionSQL)
        return result
      },
      extensions: {
        complexity: Complexity.PAGINATION,
      },
    }),
    triviaEventsOTP: gqlResolver({
      type: gqlString(),
      resolve: async (self, args, ctx) => {
        await assertAuth(ctx, ["trivia/admin"])

        const otp = ulid()

        triviaEventsOTPSet.add(otp)
        setTimeout(() => triviaEventsOTPSet.delete(otp), 5000)

        return otp
      },
      description: "requires role: trivia/admin",
      extensions: {
        complexity: Complexity.MUTATION,
      },
    }),
  },
  mutation: {
    triviaQuestionSave: gqlResolver({
      type: gqlType(TriviaQuestionGraphQL),
      args: {
        input: {
          type: gqlType(TriviaQuestionGraphQLInput),
        },
      },
      resolve: async (self, { input: _input }, ctx) => {
        const user = await currentUser(ctx)

        if (_input.id) {
          await assertAuth(ctx, ["trivia/admin"])
        }

        assertInput(TriviaQuestionSchema, _input)

        const {
          categories,
          ...input
        } = _input

        const [result] = await ctx.db.of(TriviaQuestionSQL)
          .save({
            ...input,
            updatedAt: new Date().toISOString(),
            updatedByUserId: user?.id,
          })

        await ctx.db.of(N2MTriviaQuestionTriviaCategorySQL)
          .removeMany(sql`${N2MTriviaQuestionTriviaCategorySQL.schema.questionId} = ${result.id}`)

        for (const category of categories) {
          await ctx.db.of(N2MTriviaQuestionTriviaCategorySQL)
            .save({
              questionId: result.id!,
              categoryId: category.id!,
            })
        }

        return result
      },
      description: "requires role: trivia/admin",
      extensions: {
        complexity: Complexity.MUTATION,
      },
    }),
    triviaQuestionVerifyByIds: gqlResolver({
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
      extensions: {
        complexity: Complexity.MUTATION,
      },
    }),
    triviaQuestionDisableByIds: gqlResolver({
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
      extensions: {
        complexity: Complexity.MUTATION,
      },
    }),
  },
}

export const triviaEventsOTPSet = new Set<string>()
