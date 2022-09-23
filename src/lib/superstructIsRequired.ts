import { Struct } from "superstruct"

const superstructIsRequired = <T, S>(validator: Struct<T, S>, path = "") => {
  const struct = path.split(".")
    .reduce((s, p) => {
      if (!p) {
        return s
      }

      if (!isNaN(Number(p))) {
        return s.schema
      }

      return (s.schema as Record<string, any>)[p]
    }, validator)
  if (!struct) {
    return [false, undefined] as const
  }

  let defaultValue = undefined as T | undefined

  const nullable = (() => {
    try {
      defaultValue = struct.create(null)
      return true
    } catch {
      return false
    }
  })()

  const optional = (() => {
    try {
      defaultValue = struct.create(undefined)
      return true
    } catch {
      return false
    }
  })()

  const required = (!optional && !nullable)
  return [required, defaultValue] as const
}

export default superstructIsRequired
