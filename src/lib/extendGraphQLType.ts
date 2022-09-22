import { stitchSchemas } from "@graphql-tools/stitch"
import { IFieldResolverOptions } from "@graphql-tools/utils"
import { GraphQLArgument, GraphQLObjectType, GraphQLSchema } from "graphql"

const extendGraphQLType = <T>(schema: GraphQLSchema, toExtend: GraphQLObjectType<T>, fields: Record<string, IFieldResolverOptions<T>>) => {
  const argsToString = (args: GraphQLArgument[] | undefined) => {
    if (!args?.length) {
      return ""
    }

    return `(${args.map(arg => `${arg.name}: ${arg.type}`)})`
  }

  const deprecationToString = (deprecation: string | undefined) => {
    if (!deprecation) {
      return ""
    }

    return `@deprecated(reason: "${deprecation}")`
  }

  return stitchSchemas({
    subschemas: [schema],
    typeDefs: `
      extend type ${toExtend} {
        ${Object.entries(fields)
          .map(([field, config]) => `${field}${argsToString(config.args)}: ${config.type} ${deprecationToString(config.deprecationReason)}`)
          .join("\n")
        }
      }
    `,
    resolvers: {
      [toExtend.name]: {
        ...fields,
      },
    },
  })
}

export default extendGraphQLType
