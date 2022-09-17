import Router from "@koa/router"
import { GraphQLFieldConfig, GraphQLObjectType, GraphQLSchema } from "graphql"
import { DefaultContext, DefaultState, ParameterizedContext } from "koa"
import { DatabaseRepository } from "../lib/querybuilder.js"
import { userResolver } from "./misc/user.js"
import { triviaCategoryResolver } from "./trivia/category.js"
import { triviaQuestionResolver } from "./trivia/question.js"

export type SchemaContext = {
  http: ParameterizedContext<DefaultState, DefaultContext & Router.RouterParamContext<DefaultState, DefaultContext>, unknown>
  db: DatabaseRepository
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: symbol]: any
}

export type SchemaFields = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: Record<string, GraphQLFieldConfig<{}, SchemaContext, any>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutation: Record<string, GraphQLFieldConfig<{}, SchemaContext, any>>
}

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "Query",
    fields: {
      ...userResolver.query,
      ...triviaCategoryResolver.query,
      ...triviaQuestionResolver.query,
    },
  }),
  mutation: new GraphQLObjectType({
    name: "Mutation",
    fields: {
      ...userResolver.mutation,
      ...triviaCategoryResolver.mutation,
      ...triviaQuestionResolver.mutation,
    },
  }),
})

export default schema
