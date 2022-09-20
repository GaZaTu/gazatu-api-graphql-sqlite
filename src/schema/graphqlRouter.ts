import Router from "@koa/router"
import { ExecutionResult, GraphQLError, parse, specifiedRules, validate } from "graphql"
import { compileQuery, isCompiledQuery } from "graphql-jit"
import { fieldExtensionsEstimator, getComplexity, simpleEstimator } from "graphql-query-complexity"
import { HttpError } from "koa"
import crypto from "node:crypto"
import { readFile } from "node:fs/promises"
import { any, Infer, nullable, object, optional, record, string } from "superstruct"
import { projectDir } from "../lib/moduleDir.js"
import { Complexity } from "./graphql-complexity.js"
import schema, { SchemaContext } from "./schema.js"
import useDatabaseApi from "./useDatabaseApi.js"

const GraphQLRequestSchema = object({
  query: string(),
  variables: optional(nullable(record(string(), any()))),
  operationName: optional(nullable(string())),
})

type GraphQLRequest = Infer<typeof GraphQLRequestSchema>

const complexityEstimators = [
  fieldExtensionsEstimator(),
  simpleEstimator({ defaultComplexity: Complexity.DEFAULT }),
]

export const ignoreComplexity = Symbol()

type CompiledQueryFunc<T> = (root: unknown, context: SchemaContext, variables: Record<string | symbol, unknown> | null | undefined) => Promise<ExecutionResult<T>> | ExecutionResult<T>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const graphqlQueryCache = new Map<string, CompiledQueryFunc<any>>()

export const getCompiledGraphQLQuery = async <T>(request: Omit<GraphQLRequest, "variables">) => {
  const cacheKeySource = `|${JSON.stringify(request.query)}|${JSON.stringify(request.operationName ?? "")}|`
  const cacheKey = crypto.createHash("md5").update(cacheKeySource).digest("hex")

  if (graphqlQueryCache.has(cacheKey)) {
    return graphqlQueryCache.get(cacheKey)! as CompiledQueryFunc<T>
  }

  const {
    query,
    operationName,
  } = request

  const document = parse(query, {
    maxTokens: Complexity.MAX,
  })

  const assertComplexity = (variables: Parameters<CompiledQueryFunc<T>>[2]) => {
    if (variables?.[ignoreComplexity]) {
      return
    }

    const complexity = getComplexity({
      schema,
      estimators: complexityEstimators,
      query: document,
      variables: variables ? variables : undefined,
      operationName: operationName ? operationName : undefined,
    })

    if (complexity > Complexity.MAX) {
      throw new GraphQLError(`Query is too complex: ${complexity}. Maximum allowed complexity: ${Complexity.MAX}`)
    }
  }

  const validationErrors = validate(schema, document, [...specifiedRules /** , depthLimit(8) */])
  if (validationErrors[0]) {
    throw validationErrors[0]
  }

  const compiledQuery = compileQuery(schema, document, operationName ?? undefined)
  if (!isCompiledQuery(compiledQuery)) {
    const error = compiledQuery.errors?.[0]

    if (error) {
      throw error
    } else {
      console.error(compiledQuery)
      throw new Error("Unexpected")
    }
  }

  const result: CompiledQueryFunc<T> = async (root, context, variables) => {
    assertComplexity(variables)

    const result = await compiledQuery.query(root, context, variables)
    return result as ExecutionResult<T>
  }

  // const result: CompiledQueryFunc = (root, context, variables) => {
  //   assertComplexity(variables)

  //   const result = execute({
  //     schema,
  //     document,
  //     variableValues: variables,
  //     operationName: operationName,
  //     contextValue: context,
  //     rootValue: root,
  //   })
  //   return result
  // }

  graphqlQueryCache.set(cacheKey, result)
  return result
}

export const executeGraphQLInTransaction = async <T>(request: GraphQLRequest & { context: Omit<SchemaContext, "cache" | "db"> }, options?: { dbApi?: SchemaContext["db"], throwErrors?: boolean, ignoreComplexity?: boolean }) => {
  const execute = await getCompiledGraphQLQuery<T>(request)
  const dbApi = options?.dbApi ?? await useDatabaseApi()

  const context = {
    ...request.context,
    db: dbApi,
    cache: {},
  }

  const variables = {
    ...request.variables,
    ...(options?.ignoreComplexity ? { [ignoreComplexity]: true } : {}),
  }

  const result = await dbApi.transaction(() => execute({}, context, variables))
  if (options?.throwErrors && result.errors?.[0]) {
    throw result.errors?.[0]
  }

  return result
}

export const handleGraphQLRequest = async (ctx: SchemaContext["http"], requestObject: unknown) => {
  const request = (() => {
    try {
      return GraphQLRequestSchema.create(requestObject)
    } catch (error) {
      throw ctx.throw(400, error as Error)
    }
  })()

  let accept = ctx.accepts("application/graphql-response+json", "application/json")
  if (!accept) {
    accept = "application/json"
  }

  let charset = ctx.acceptsCharsets("utf-8")
  if (!charset) {
    charset = "utf-8"
  }

  const response = await (async () => {
    try {
      return await executeGraphQLInTransaction({
        ...request,
        context: {
          http: ctx,
        },
      })
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw ctx.throw(400, error)
      }

      throw error
    }
  })()

  ctx.response.status = 200

  if (accept === "application/graphql-response+json") {
    for (const error of response.errors ?? []) {
      ctx.response.status = 400

      if (error instanceof GraphQLError) {
        if (error.originalError instanceof HttpError) {
          ctx.response.status = error.originalError.status
        }
      }
    }
  }

  ctx.response.type = `${accept}; charset=${charset}`
  ctx.response.body = {
    ...response,
    errors: response.errors?.slice(0, 5),
  }
}

/**
 * mostly compliant with https://github.com/graphql/graphql-over-http/blob/main/spec/GraphQLOverHTTP.md
 */
const graphqlRouter = new Router()

export default graphqlRouter

graphqlRouter.get("/graphql/schema.gql", async ctx => {
  ctx.response.type = "application/graphql"
  ctx.response.body = await readFile(`${projectDir}/data/schema.gql`)
})

graphqlRouter.get("/graphql/schema.gql.ts", async ctx => {
  ctx.response.type = "application/typescript"
  ctx.response.body = await readFile(`${projectDir}/data/schema.gql.ts`)
})

graphqlRouter.post("/graphql", async ctx => {
  if (!ctx.is("application/json")) {
    throw ctx.throw(400, new Error("Allowed Content-Type's: application/json"))
  }

  await handleGraphQLRequest(ctx, ctx.request.body)
})

graphqlRouter.get("/graphql", async ctx => {
  const {
    query: queryParam,
    variables: variablesParam,
    operationName,
  } = ctx.request.query

  const query = String(queryParam)
  const variables = variablesParam ? JSON.parse(String(variablesParam)) : undefined

  if (!query.startsWith("{") || !query.endsWith("}")) {
    throw ctx.throw(405, "Expected GraphQL format: { ... }")
  }

  await handleGraphQLRequest(ctx, { query, variables, operationName })
})
