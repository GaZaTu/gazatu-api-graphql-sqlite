import * as gql from "graphql"
import ts from "typescript"

interface GraphQLToTypeScriptConverterState {
  mode: "simple" | "full"
  interfacesImplementationsMap: Map<string, Set<string>>
}

const unwrapNullableTsType = (type: ts.TypeNode) => {
  if (ts.isUnionTypeNode(type)) {
    return type.types[0]
  } else {
    return type
  }
}

const gqlTypeNameToTsTypeName = (typeName: string): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map: any = {
    "String": "string",
    "Float": "number",
    "Int": "number",
    "ID": "string",
    "Boolean": "boolean",
  }

  return map[typeName] || typeName
}

const gqlTypeToTsType = (type: gql.TypeNode): ts.TypeNode => {
  switch (type.kind) {
    case "ListType":
      return ts.factory.createUnionTypeNode([ts.factory.createArrayTypeNode(gqlTypeToTsType(type.type)), ts.factory.createTypeReferenceNode("null")])
    case "NamedType":
      return ts.factory.createUnionTypeNode([ts.factory.createTypeReferenceNode(gqlTypeNameToTsTypeName(type.name.value), undefined), ts.factory.createTypeReferenceNode("null")])
    case "NonNullType": {
      return unwrapNullableTsType(gqlTypeToTsType(type.type))
    }
    default:
      return undefined!
  }
}

const gqlFieldToTsProperty = (definition: gql.FieldDefinitionNode | gql.InputValueDefinitionNode) => {
  const fieldType = gqlTypeToTsType(definition.type)

  return ts.factory.createPropertySignature(
    undefined,
    definition.name.value,
    ts.isUnionTypeNode(fieldType) ? ts.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined,
    fieldType,
  )
}

const gqlFieldToTsPropertyOrMethod = (state: GraphQLToTypeScriptConverterState, definition: gql.FieldDefinitionNode | gql.InputValueDefinitionNode) => {
  if (state.mode === "full" && definition.kind === "FieldDefinition" && definition.arguments?.length) {
    // return gqlFieldToTsMethod(definition)
    return undefined!
  } else {
    return gqlFieldToTsProperty(definition)
  }
}

const gqlObjectTypeToTsInterface = (state: GraphQLToTypeScriptConverterState, definition: gql.ObjectTypeDefinitionNode | gql.InputObjectTypeDefinitionNode) => {
  if (definition.kind === "ObjectTypeDefinition") {
    for (const intf of definition.interfaces || []) {
      let implementations = state.interfacesImplementationsMap.get(intf.name.value)

      if (!implementations) {
        state.interfacesImplementationsMap.set(intf.name.value, implementations = new Set())
      }

      implementations.add(definition.name.value)
    }
  }

  return ts.factory.createInterfaceDeclaration(
    [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
    definition.name.value,
    undefined,
    undefined,
    [
      ...(definition.kind === "ObjectTypeDefinition" ?
        [ts.factory.createPropertySignature(
          undefined,
          "__typename",
          state.mode === "simple" ? ts.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined,
          ts.factory.createTypeReferenceNode(`"${definition.name.value}"`, undefined),
        )] : []),
      // eslint-disable-next-line no-unsafe-optional-chaining
      ...(definition.fields as (gql.FieldDefinitionNode | gql.InputValueDefinitionNode)[])
        ?.map(field => gqlFieldToTsPropertyOrMethod(state, field))
        ?.map(propOrMethod => {
          if (state.mode === "simple" && definition.kind === "ObjectTypeDefinition" && ts.isPropertySignature(propOrMethod)) {
            return ts.factory.updatePropertySignature(
              propOrMethod,
              undefined,
              propOrMethod.name,
              ts.factory.createToken(ts.SyntaxKind.QuestionToken),
              propOrMethod.type,
            )
          } else {
            return propOrMethod
          }
        }),
    ],
  )
}

const gqlScalarTypeToTsScalarType = (definition: gql.ScalarTypeDefinitionNode) => {
  return ts.factory.createTypeAliasDeclaration(
    [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
    definition.name.value,
    undefined,
    ts.factory.createTypeReferenceNode("unknown", undefined),
  )
}

const gqlUnionTypeToTsUnionType = (definition: gql.UnionTypeDefinitionNode) => {
  return ts.factory.createTypeAliasDeclaration(
    [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
    definition.name.value,
    undefined,
    ts.factory.createUnionTypeNode(
      definition.types?.map(gqlTypeToTsType)?.map(unwrapNullableTsType) || [],
    ),
  )
}

const gqlEnumTypeToTsEnumType = (definition: gql.EnumTypeDefinitionNode) => {
  return ts.factory.createEnumDeclaration(
    [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
    definition.name.value,
    definition.values
      ?.map(value => value.name.value)
      ?.map(valueName => ts.factory.createEnumMember(valueName, ts.factory.createStringLiteral(valueName))) || [],
  )
}

const gqlDefinitionToTsDeclaration = (state: GraphQLToTypeScriptConverterState, definition: gql.DefinitionNode) => {
  switch (definition.kind) {
    case "InterfaceTypeDefinition":
    case "InputObjectTypeDefinition":
      return undefined
    case "ObjectTypeDefinition":
      return gqlObjectTypeToTsInterface(state, definition)
    case "ScalarTypeDefinition":
      return gqlScalarTypeToTsScalarType(definition)
    case "UnionTypeDefinition":
      return gqlUnionTypeToTsUnionType(definition)
    case "EnumTypeDefinition":
      return gqlEnumTypeToTsEnumType(definition)
    default:
      console.warn(`Unsupported GraphQL-Definition ${definition.kind}`)
      return undefined
  }
}

const createGqlInterfacesAsTsUnionsFromState = (state: GraphQLToTypeScriptConverterState) => {
  return [...state.interfacesImplementationsMap]
    .map(([intf, impls]) => (
      ts.factory.createTypeAliasDeclaration(
        [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
        intf,
        undefined,
        ts.factory.createUnionTypeNode(
          [...impls].map(impl => ts.factory.createTypeReferenceNode(gqlTypeNameToTsTypeName(impl), undefined)),
        ),
      )
    ))
}

const gqlToTs = (gqlSchemaAsString: string, { mode }: { mode: "simple" | "full" } = { mode: "simple" }) => {
  const resultFile = ts.createSourceFile(
    "schema.ts",
    "",
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  )

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
  })

  const gqlSchema = gql.parse(gqlSchemaAsString)

  const converterState: GraphQLToTypeScriptConverterState = {
    mode,
    interfacesImplementationsMap: new Map(),
  }

  const isTruthy = <V>(v: V): v is Exclude<V, null | undefined> => !!v

  const convert = (gqlDefinition: gql.DefinitionNode) =>
    gqlDefinitionToTsDeclaration(converterState, gqlDefinition)

  const tsNodes = ts.factory.createNodeArray([
    ...gqlSchema.definitions.map(convert).filter(isTruthy),
    ...createGqlInterfacesAsTsUnionsFromState(converterState),
  ])

  return printer.printList(ts.ListFormat.MultiLine, tsNodes, resultFile)
}

export default gqlToTs
