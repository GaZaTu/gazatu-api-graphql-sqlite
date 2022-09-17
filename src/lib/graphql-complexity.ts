import { ComplexityEstimator } from "graphql-query-complexity"

export const Complexity = {
  DEFAULT: 1,
  VIRTUAL_FIELD: 5,
  SIMPLE_QUERY: 10,
  MUTATION: 20,
  MAX: 256,
  PAGINATION: (({ args, childComplexity }) => {
    return childComplexity * Math.ceil((args.limit ?? 25) / 5)
  }) as ComplexityEstimator,
}
