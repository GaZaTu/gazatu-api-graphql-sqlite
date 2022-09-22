import { GraphQLFieldConfig, GraphQLObjectType, GraphQLSchema } from "graphql"
import { ParameterizedContext } from "koa"
import { DatabaseRepository } from "../lib/querybuilder.js"
import { userResolver } from "./misc/user.js"
import { triviaCategoryResolver } from "./trivia/category.js"
import { triviaExtensionsResolver } from "./trivia/extensions.js"
import { triviaQuestionResolver } from "./trivia/question.js"
import { triviaReportResolver } from "./trivia/report.js"

export type SchemaContext = {
  http: ParameterizedContext
  db: DatabaseRepository
  cache: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string | symbol]: any
  }
}

export type SchemaFields = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query?: Record<string, GraphQLFieldConfig<{}, SchemaContext, any>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutation?: Record<string, GraphQLFieldConfig<{}, SchemaContext, any>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscription?: Record<string, GraphQLFieldConfig<{}, SchemaContext, any>>
  extend?: (schema: GraphQLSchema) => GraphQLSchema
}

const buildSchema = (resolvers: SchemaFields[]) => {
  const getFieldsAsArray = (key: keyof SchemaFields) =>
    resolvers
      .filter(r => !!r[key])
      .flatMap(r => Object.entries(r[key]!))

  const queryFields = getFieldsAsArray("query")
  const mutationFields = getFieldsAsArray("mutation")
  const subscriptionFields = getFieldsAsArray("subscription")

  let schema = new GraphQLSchema({
    query: queryFields.length ? new GraphQLObjectType({
      name: "Query",
      fields: Object.fromEntries(queryFields),
    }) : undefined,
    mutation: mutationFields.length ? new GraphQLObjectType({
      name: "Mutation",
      fields: Object.fromEntries(mutationFields),
    }) : undefined,
    subscription: subscriptionFields.length ? new GraphQLObjectType({
      name: "Subscription",
      fields: Object.fromEntries(subscriptionFields),
    }) : undefined,
  })

  for (const { extend } of resolvers) {
    if (extend) {
      schema = extend(schema)
    }
  }

  return schema
}

const schema = buildSchema([
  userResolver,
  triviaCategoryResolver,
  triviaQuestionResolver,
  triviaReportResolver,
  triviaExtensionsResolver,
])

export default schema
