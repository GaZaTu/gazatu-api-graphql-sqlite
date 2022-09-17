import Router from "@koa/router"
import { GraphQLFieldConfig, GraphQLObjectType, GraphQLSchema } from "graphql"
import { DefaultContext, DefaultState, ParameterizedContext } from "koa"
import { DatabaseRepository } from "../lib/querybuilder.js"
import { triviaCategoryResolver } from "./trivia/category.js"
import { triviaQuestionResolver } from "./trivia/question.js"

export type SchemaContext = {
  ctx: ParameterizedContext<DefaultState, DefaultContext & Router.RouterParamContext<DefaultState, DefaultContext>, unknown>
  db: DatabaseRepository
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: symbol]: any
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
