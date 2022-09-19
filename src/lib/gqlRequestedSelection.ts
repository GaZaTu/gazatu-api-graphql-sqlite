import { GraphQLResolveInfo, SelectionSetNode } from "graphql"

interface Selection {
  [key: string]: true | Selection
}

const parseSelectionSet = (selectionSet: SelectionSetNode): Selection => {
  return Object.fromEntries(
    selectionSet.selections
      .map(selection => {
        if (selection.kind === "Field") {
          const name = selection.name.value

          if (selection.selectionSet) {
            return [name, parseSelectionSet(selection.selectionSet)]
          } else {
            return [name, true]
          }
        }

        return undefined!
      })
      .filter(s => !!s)
  )
}

const gqlRequestedSelection = (info: GraphQLResolveInfo) => {
  const selectionSet = info.fieldNodes?.[0].selectionSet
  if (!selectionSet) {
    return undefined
  }

  const result = parseSelectionSet(selectionSet)
  return result
}

export default gqlRequestedSelection

export const gqlRequestedFields = (info: GraphQLResolveInfo, path?: string) => {
  const selection = gqlRequestedSelection(info)
  if (!selection) {
    return []
  }

  if (!path) {
    return Object.keys(selection)
  }

  const selectionChild = path.split(".")
    .reduce((o, p) => o[p] as Selection, selection)

  const result = Object.keys(selectionChild)
  return result
}
