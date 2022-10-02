import { boolean, Infer, nullable, object, optional, size, string } from "superstruct"
import gqlResolver, { gqlArgsInput, gqlArray, gqlBoolean, gqlNullable, gqlString, gqlType, gqlVoid } from "../../lib/gqlResolver.js"
import { ASSIGN, sql } from "../../lib/querybuilder.js"
import superstructToGraphQL from "../../lib/superstructToGraphQL.js"
import superstructToSQL from "../../lib/superstructToSQL.js"
import assertAuth from "../assertAuth.js"
import assertInput from "../assertInput.js"
import { Complexity } from "../graphql-complexity.js"
import type { SchemaFields } from "../schema.js"

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
] = superstructToGraphQL(TriviaCategorySchema, {
  name: "TriviaCategory",
  fields: {},
  inputUnset: [
    "verified",
    "disabled",
    "createdAt",
    "updatedAt",
  ],
})

export const [
  TriviaCategorySQL,
] = superstructToSQL(TriviaCategorySchema, {
  name: "TriviaCategory",
})

export type TriviaCategory = Infer<typeof TriviaCategorySchema>

export const triviaCategoryResolver: SchemaFields = {
  query: {
    triviaCategoryById: gqlResolver({
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
      description: "",
      extensions: {
        complexity: Complexity.SIMPLE_QUERY,
      },
    }),
    triviaCategoryList: gqlResolver({
      type: gqlArray(gqlType(TriviaCategoryGraphQL)),
      args: gqlArgsInput("TriviaCategoryListArgs", {
        verified: {
          type: gqlNullable(gqlBoolean()),
          defaultValue: null,
        },
        disabled: {
          type: gqlNullable(gqlBoolean()),
          defaultValue: false,
        },
      }),
      resolve: async (self, { args }, ctx) => {
        const result = await ctx.db
          .select(TriviaCategorySQL)
          .where((typeof args?.verified === "boolean") && sql`${TriviaCategorySQL.schema.verified} = ${args.verified}`)
          .where((typeof args?.disabled === "boolean") && sql`${TriviaCategorySQL.schema.disabled} = ${args.disabled}`)
          .orderBy(TriviaCategorySQL.schema.name, "ASC")
          .findMany(TriviaCategorySQL)
        return result
      },
      description: "",
      extensions: {
        complexity: Complexity.PAGINATION,
      },
    }),
  },
  mutation: {
    triviaCategorySave: gqlResolver({
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

        input.name = input.name.trim()

        const [result] = await ctx.db.of(TriviaCategorySQL)
          .save(input)
        return result
      },
      description: "requires role: trivia/admin",
      extensions: {
        complexity: Complexity.MUTATION,
      },
    }),
    triviaCategoryListVerifyByIds: gqlResolver({
      type: gqlVoid(),
      args: {
        ids: {
          type: gqlArray(gqlString()),
        },
      },
      resolve: async (self, { ids }, ctx) => {
        await assertAuth(ctx, ["trivia/admin"])

        await ctx.db.of(TriviaCategorySQL)
          .updateManyById(ASSIGN(TriviaCategorySQL.schema.verified, true), ids)
      },
      description: "requires role: trivia/admin",
      extensions: {
        complexity: Complexity.MUTATION,
      },
    }),
    triviaCategoryListRemoveByIds: gqlResolver({
      type: gqlVoid(),
      args: {
        ids: {
          type: gqlArray(gqlString()),
        },
      },
      resolve: async (self, { ids }, ctx) => {
        await assertAuth(ctx, ["trivia/admin"])

        await ctx.db.of(TriviaCategorySQL)
          .removeManyById(ids)
      },
      description: "requires role: trivia/admin",
      extensions: {
        complexity: Complexity.MUTATION,
      },
    }),
  },
}
