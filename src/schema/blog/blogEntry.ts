import { Infer, integer, nullable, object, optional, size, string } from "superstruct"
import gqlResolver, { gqlArgsInput, gqlArray, gqlNullable, gqlString, gqlType, gqlVoid } from "../../lib/gqlResolver.js"
import superstructToGraphQL from "../../lib/superstructToGraphQL.js"
import superstructToSQL from "../../lib/superstructToSQL.js"
import assertAuth from "../assertAuth.js"
import assertInput from "../assertInput.js"
import { Complexity } from "../graphql-complexity.js"
import { findManyPaginated, gqlPagination, gqlPaginationArgs } from "../pagination.js"
import type { SchemaFields } from "../schema.js"

export const BlogEntrySchema = object({
  id: optional(nullable(string())),
  story: size(string(), 1, 256),
  title: size(string(), 1, 256),
  message: optional(nullable(string())),
  imageFileExtension: optional(nullable(size(string(), 1, 32))),
  imageWidth: optional(nullable(integer())),
  imageHeight: optional(nullable(integer())),
  createdAt: optional(nullable(string())),
})

export const [
  BlogEntryGraphQL,
  BlogEntryGraphQLInput,
] = superstructToGraphQL(BlogEntrySchema, {
  name: "BlogEntry",
  fields: {},
  inputUnset: [
    "createdAt",
  ],
})

export const [
  BlogEntrySQL,
] = superstructToSQL(BlogEntrySchema, {
  name: "BlogEntry",
})

export type BlogEntry = Infer<typeof BlogEntrySchema>

export const blogEntryResolver: SchemaFields = {
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
      description: "",
      extensions: {
        complexity: Complexity.SIMPLE_QUERY,
      },
    }),
    blogEntryListConnection: gqlResolver({
      type: gqlPagination(gqlType(BlogEntryGraphQL)),
      args: gqlArgsInput("BlogEntryListConnectionArgs", {
        ...gqlPaginationArgs,
      }),
      resolve: async (self, { args }, ctx) => {
        const query = ctx.db
          .select(BlogEntrySQL)

        const result = await findManyPaginated(query, args, BlogEntrySQL)
        return result
      },
      description: "",
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
      description: "requires role: admin",
      extensions: {
        complexity: Complexity.MUTATION,
      },
    }),
    blogEntryListRemoveByIds: gqlResolver({
      type: gqlVoid(),
      args: {
        ids: {
          type: gqlArray(gqlString()),
        },
      },
      resolve: async (self, { ids }, ctx) => {
        await assertAuth(ctx, ["admin"])

        await ctx.db.of(BlogEntrySQL)
          .removeManyById(ids)
      },
      description: "requires role: admin",
      extensions: {
        complexity: Complexity.MUTATION,
      },
    }),
  },
}
