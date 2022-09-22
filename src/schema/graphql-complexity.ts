import { ComplexityEstimator } from "graphql-query-complexity"

export const Complexity = {
  DEFAULT: 1,
  VIRTUAL_FIELD: 10,
  SIMPLE_QUERY: 25,
  MUTATION: 100,
  PAGINATION: (({ args, childComplexity }) => {
    const limit = args?.args?.limit ?? args?.limit ?? 25
    if (!limit) {
      return Number.MAX_SAFE_INTEGER
    }

    const result = childComplexity * Math.ceil(limit / 3)
    return result
  }) as ComplexityEstimator,
  MAX: 690,
}
