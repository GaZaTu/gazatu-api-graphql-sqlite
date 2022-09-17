import { graphql, GraphQLError, parse } from "graphql"
import { fieldExtensionsEstimator, getComplexity, simpleEstimator } from "graphql-query-complexity"
import { mkdir, writeFile } from "node:fs/promises"
import { Complexity } from "./lib/graphql-complexity.js"
import moduleDir from "./lib/moduleDir.js"
import { connect } from "./schema/database.js"
import schema, { schemaAsGQL, schemaAsTS } from "./schema/index.js"

const __dirname = moduleDir(import.meta.url)

const handleGraphQLRequest = async (options: { query: string, variables?: Record<string, unknown> }) => {
  const complexity = getComplexity({
    schema,
    estimators: [
      fieldExtensionsEstimator(),
      simpleEstimator({ defaultComplexity: Complexity.DEFAULT }),
    ],
    query: parse(options.query, { maxTokens: 100 }),
    variables: options.variables,
  })

  if (complexity > Complexity.MAX) {
    throw new GraphQLError(`Query is too complex: ${complexity}. Maximum allowed complexity: ${Complexity.MAX}`)
  }

  const [db, dbApi] = await connect()

  try {
    return await dbApi.transaction(async () => {
      return await graphql({
        schema,
        source: options.query,
        variableValues: options.variables,
        contextValue: {
          db: dbApi,
        },
      })
    })
  } finally {
    await db.close()
  }
}

void (async () => {
  await mkdir(`${__dirname}/../data`, { recursive: true })
  await writeFile(`${__dirname}/../data/schema.gql`, schemaAsGQL)
  await writeFile(`${__dirname}/../data/schema.gql.ts`, schemaAsTS)

  const result2 = await handleGraphQLRequest({
    // query: `
    //   mutation M($category: TriviaCategoryInput!, $question: TriviaQuestionInput!) {
    //     saveTriviaCategory(input: $category) {
    //       id
    //       name
    //     }

    //     saveTriviaQuestion(input: $question) {
    //       id
    //       category {
    //         id
    //         name
    //       }
    //       question
    //       answer
    //     }
    //   }
    // `,
    query: `
      query Q {
        triviaQuestions {
          id
          category {
            id
            name
          }
          question
          answer
        }
      }
    `,
    variables: {
      category: {
        id: "01GD4542GKFHMKTP7B85NC9B84",
        name: "IGNORED",
      },
      question: {
        category: {
          id: "01GD4542GKFHMKTP7B85NC9B84",
          name: "IGNORED",
        },
        question: "QUESTION1",
        answer: "ANSWER1",
      },
    },
  })

  console.log("result2", JSON.stringify(result2, undefined, "  "))
})().then(console.log, console.error)
