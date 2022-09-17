import { GraphQLFieldConfig, GraphQLObjectType, GraphQLSchema, printSchema } from "graphql"
import gqlToTs from "../lib/gqlToTs.js"
import { DatabaseRepository } from "../lib/querybuilder.js"
import { triviaCategoryResolver } from "./trivia/category.js"
import { triviaQuestionResolver } from "./trivia/question.js"

export type SchemaContext = {
  db: DatabaseRepository
}

export type SchemaFields = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: Record<string, GraphQLFieldConfig<any, SchemaContext, any>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutation: Record<string, GraphQLFieldConfig<any, SchemaContext, any>>
}

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "Query",
    fields: {
      ...triviaCategoryResolver.query,
      ...triviaQuestionResolver.query,
    },
  }),
  mutation: new GraphQLObjectType({
    name: "Mutation",
    fields: {
      ...triviaCategoryResolver.mutation,
      ...triviaQuestionResolver.mutation,
    },
  }),
})

export default schema

export const schemaAsGQL = printSchema(schema)
export const schemaAsTS = gqlToTs(schemaAsGQL)
