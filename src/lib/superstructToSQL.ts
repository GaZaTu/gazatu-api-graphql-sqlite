import { Struct } from "superstruct"
import { SQLEntity, SqlField } from "./querybuilder.js"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function superstructToSQL<T, S extends Record<string, Struct<any, any>>>(struct: Struct<T, S>, config: { name: string }) {
  const sqlEntity = new SQLEntity(
    config.name,
    r => r as T,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Object.keys(struct.schema).reduce((o, f) => { o[f] = new SqlField(f, config.name); return o }, {} as any),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    alias => new Proxy({}, { get: (t, p) => new SqlField(p as string, alias) }) as any,
  )

  return [sqlEntity] as const
}

export default superstructToSQL
