import { Struct } from "superstruct"
import { SQLEntity } from "./querybuilder.js"

function superstructToSQL<T, S>(struct: Struct<T, S>, config: { name: string }) {
  const sqlEntity: SQLEntity<T> = {
    entityName: config.name,
    coerce: r => r as T,
  }

  return [sqlEntity] as const
}

export default superstructToSQL
