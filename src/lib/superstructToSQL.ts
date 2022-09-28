import { Struct } from "superstruct"
import { SQLEntity, SqlField } from "./querybuilder.js"

function superstructToSQL<T, S extends Record<string, Struct<any, any>>>(struct: Struct<T, S>, config: { name: string, skip?: (keyof S)[] }) {
  const sqlEntity = new SQLEntity(
    config.name,
    r => r as T,
    Object.keys(struct.schema).filter(f => !config.skip?.includes(f)).reduce((o, f) => { o[f] = new SqlField(f, config.name); return o }, {} as any),
    alias => new Proxy({}, { get: (t, p) => new SqlField(p as string, alias) }) as any,
  )

  return [sqlEntity] as const
}

export default superstructToSQL
