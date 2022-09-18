import Router from "@koa/router"
import { execute, GraphQLError, parse } from "graphql"
import { fieldExtensionsEstimator, getComplexity, simpleEstimator } from "graphql-query-complexity"
import { any, Infer, object, optional, record, string } from "superstruct"
import { Complexity } from "../lib/graphql-complexity.js"
import connectDatabase from "./connectDatabase.js"
import schema, { SchemaContext } from "./schema.js"

const GraphQLRequest = object({
  query: string(),
  variables: optional(record(string(), any())),
  operationName: optional(string()),
})

export const executeGraphQL = async (request: Infer<typeof GraphQLRequest> & { context: Omit<SchemaContext, "cache"> }) => {
  const {
    query,
    variables,
    operationName,
    context,
  } = request

  const document = parse(query, { maxTokens: Complexity.MAX })

  const complexity = getComplexity({
    schema,
    estimators: [
      fieldExtensionsEstimator(),
      simpleEstimator({ defaultComplexity: Complexity.DEFAULT }),
    ],
    query: document,
    variables,
    operationName,
  })

  if (complexity > Complexity.MAX) {
    throw new GraphQLError(`Query is too complex: ${complexity}. Maximum allowed complexity: ${Complexity.MAX}`)
  }

  return await execute({
    schema,
    document,
    variableValues: variables,
    operationName,
    contextValue: {
      ...context,
      cache: {},
    },
  })
}

const handleGraphQLRequest = async (request: Infer<typeof GraphQLRequest> & { context: Omit<SchemaContext, "cache" | "db"> }) => {
  const [db, dbApi] = await connectDatabase({ trace: false })

  try {
    return await dbApi.transaction(async () => {
      return await executeGraphQL({
        ...request,
        context: {
          ...request.context,
          db: dbApi,
        },
      })
    })
  } finally {
    await db.close()
  }
}

export default handleGraphQLRequest

export const graphqlRouter = new Router()

graphqlRouter.post("/graphql", async ctx => {
  const request = GraphQLRequest.create(ctx.request.body)
  const response = await handleGraphQLRequest({
    ...request,
    context: {
      http: ctx,
    },
  })

  ctx.response.body = response
})
