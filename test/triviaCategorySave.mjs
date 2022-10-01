process.env.NODE_ENV = "test"

import { expect } from "chai"
import { afterEach, describe, test } from "mocha"
import { executeGraphQLWithDatabase } from "../dist/schema/graphqlRouter.js"
import useDatabaseApi, { databaseConnections } from "../dist/schema/useDatabaseApi.js"

describe("graphql", () => {
  afterEach(() => databaseConnections.clear())

  test("triviaCategorySave", () => useDatabaseApi(async db => {
    const variables = {
      input: {
        name: "TEST",
      },
    }

    const { data: mutationResult } = await executeGraphQLWithDatabase({
      query: `
        mutation ($input: TriviaCategoryInput!) {
          triviaCategorySave(input: $input) {
            id
            name
          }
        }
      `,
      variables,
    }, {
      db,
      throwErrors: true,
    })

    const mutationValue = mutationResult?.triviaCategorySave
    expect(mutationValue).to.to.be.a("object")

    expect(mutationValue.id).to.be.a("string")
    expect(mutationValue.name).to.be.eq(variables.input.name)

    const { data: queryResult } = await executeGraphQLWithDatabase({
      query: `
        query ($id: String!) {
          triviaCategoryById(id: $id) {
            id
            name
          }
        }
      `,
      variables: {
        id: mutationValue.id,
      },
    }, {
      db,
      throwErrors: true,
    })

    const queryValue = queryResult?.triviaCategoryById
    expect(queryValue).to.to.be.a("object")

    expect(queryValue.id).to.be.eq(mutationValue.id)
    expect(queryValue.name).to.be.eq(mutationValue.name)
  }))
})
