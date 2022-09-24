import { Infer, nullable, object, optional, size, string } from "superstruct"
import gqlResolver, { gqlArgsInput, gqlArray, gqlNullable, gqlString, gqlType } from "../../lib/gqlResolver.js"
import superstructToGraphQL from "../../lib/superstructToGraphQL.js"
import superstructToSQL from "../../lib/superstructToSQL.js"
import assertAuth from "../assertAuth.js"
import assertInput from "../assertInput.js"
import { Complexity } from "../graphql-complexity.js"
import type { SchemaFields } from "../schema.js"

export const BlogEntrySchema = object({
  id: optional(nullable(string())),
  story: size(string(), 1, 256),
  title: size(string(), 1, 256),
  message: optional(nullable(string())),
  imageMimeType: optional(nullable(size(string(), 1, 64))),
  imageFileExtension: optional(nullable(size(string(), 1, 32))),
  createdAt: optional(nullable(string())),
  updatedAt: optional(nullable(string())),
})

export const [
  BlogEntryGraphQL,
  BlogEntryGraphQLInput,
] = superstructToGraphQL(BlogEntrySchema, {
  name: "BlogEntry",
  fields: {},
  inputUnset: [
    "createdAt",
    "updatedAt",
  ],
})

export const [
  BlogEntrySQL,
] = superstructToSQL(BlogEntrySchema, {
  name: "BlogEntry",
})

export type BlogEntry = Infer<typeof BlogEntrySchema>

export const BlogEntryResolver: SchemaFields = {
  query: {
    blogEntryById: gqlResolver({
      type: gqlNullable(gqlType(BlogEntryGraphQL)),
      args: {
        id: {
          type: gqlString(),
        },
      },
      resolve: async (self, { id }, ctx) => {
        const result = await ctx.db.of(BlogEntrySQL)
          .findOneById(id)
        return result
      },
      extensions: {
        complexity: Complexity.SIMPLE_QUERY,
      },
    }),
    blogEntryList: gqlResolver({
      type: gqlArray(gqlType(BlogEntryGraphQL)),
      args: gqlArgsInput("BlogEntryListArgs", {
      }),
      resolve: async (self, { args }, ctx) => {
        const result = await ctx.db
          .select(BlogEntrySQL)
          .findMany(BlogEntrySQL)
        return result
      },
      extensions: {
        complexity: Complexity.PAGINATION,
      },
    }),
  },
  mutation: {
    blogEntrySave: gqlResolver({
      type: gqlType(BlogEntryGraphQL),
      args: {
        input: {
          type: gqlType(BlogEntryGraphQLInput),
        },
      },
      resolve: async (self, { input }, ctx) => {
        await assertAuth(ctx, ["admin"])

        assertInput(BlogEntrySchema, input)

        const [result] = await ctx.db.of(BlogEntrySQL)
          .save(input)
        return result
      },
      description: "requires role: trivia/admin",
      extensions: {
        complexity: Complexity.MUTATION,
      },
    }),
  },
}
