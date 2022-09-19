import { ComplexityEstimator } from "graphql-query-complexity"

export const Complexity = {
  DEFAULT: 1,
  VIRTUAL_FIELD: 5,
  SIMPLE_QUERY: 10,
  MUTATION: 20,
  MAX: 1000,
  PAGINATION: (({ args, childComplexity }) => {
    return childComplexity * Math.ceil((args?.args?.limit ?? args?.limit ?? 25) / 5)
  }) as ComplexityEstimator,
}
