import { ComplexityEstimator } from "graphql-query-complexity"

export const COMPLEXITY_DEFAULT = 1

export const COMPLEXITY_VIRTUAL_FIELD = 5

export const COMPLEXITY_SIMPLE_QUERY = 10

export const COMPLEXITY_MUTATION = 20

export const COMPLEXITY_MAX = 256

export const COMPLEXITY_PAGINATION: ComplexityEstimator = ({ args, childComplexity }) => {
  return childComplexity * Math.ceil((args.limit ?? 25) / 5)
}
