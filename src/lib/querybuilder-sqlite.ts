import { ulid } from "ulid"
import { DatabaseRepository, Deleter, Inserter, QueryBuilderData, QueryBuilderUpsertMode, Selector, SQLEntity, SqlExpr, SqlField, SqlOperator, Updater } from "./querybuilder.js"

const createSelectScript = (data: QueryBuilderData) => {
  let script = "SELECT"

  if (data.distinct) {
    script += " DISTINCT"
  }

  for (let i = 0; i < (data.fields?.length ?? 0); i++) {
    script += (i === 0) ? "\n  " : ",\n  "
    script += `${data.fields![i]}`
  }

  if (data.table) {
    script += `\nFROM ${data.table}`
  }

  for (let i = 0; i < (data.joins?.length ?? 0); i++) {
    script += "\n"
    script += `${data.joins![i].mode ?? "JOIN"} ${data.joins![i].table}${data.joins![i].condition ? ` ON ${data.joins![i].condition?.query}` : ""}`
  }

  for (let i = 0; i < (data.conditions?.length ?? 0); i++) {
    script += (i === 0) ? "\nWHERE\n  " : " AND\n  "
    script += data.conditions![i].query
  }

  for (let i = 0; i < (data.groupings?.length ?? 0); i++) {
    script += (i === 0) ? "\nGROUP BY\n  " : ",\n  "
    script += data.groupings![i].query
  }

  for (let i = 0; i < (data.groupingConditions?.length ?? 0); i++) {
    script += (i === 0) ? "\nHAVING\n  " : " AND\n  "
    script += data.groupingConditions![i].query
  }

  for (let i = 0; i < (data.ordering?.length ?? 0); i++) {
    script += (i === 0) ? "\nORDER BY\n  " : ",\n  "
    script += `${data.ordering![i].field.query} ${data.ordering![i].direction ?? ""} ${data.ordering![i].nulls ?? ""}`
  }

  if (data.limit || data.offset) {
    script += `\nLIMIT ${data.limit?.query ?? -1}`
  }

  if (data.offset) {
    script += `\nOFFSET ${data.offset.query}`
  }

  return script
}

const createInsertScript = (data: QueryBuilderData) => {
  let script = `INSERT INTO ${data.table}`

  script += ` (${(data.assignments ?? []).map(e => `\n  ${e.queryLeft}`).join(",")}\n)`
  script += ` VALUES (${(data.assignments ?? []).map(e => "\n  ?").join(",")}\n)`

  return script
}

const createUpdateScript = (data: QueryBuilderData) => {
  let script = `UPDATE ${data.table ?? ""}\nSET`

  for (let i = 0; i < (data.assignments?.length ?? 0); i++) {
    script += (i === 0) ? "\n  " : ",\n  "
    script += data.assignments![i].query
  }

  for (let i = 0; i < (data.conditions?.length ?? 0); i++) {
    script += (i === 0) ? "\nWHERE\n  " : " AND\n  "
    script += data.conditions![i].query
  }

  return script
}

const createUpsertScript = (_data: QueryBuilderData) => {
  const { ...data } = _data

  let script = createInsertScript(data)
  if (!data.upsert) {
    return script
  }

  script += "\nON CONFLICT"

  if (data.fields) {
    script += ` (${(data.fields ?? []).map(f => `${f}`).join(", ")})`
  }

  script += " DO"

  switch (data.upsert) {
    case QueryBuilderUpsertMode.NOTHING:
      script += " NOTHING"
      break

    case QueryBuilderUpsertMode.MERGE:
      data.table = undefined
      data.assignments = data.assignments?.map(e => {
        if (e.operator === SqlOperator.ASSIGN) {
          return new SqlExpr(`${e.queryLeft} = EXCLUDED.${e.queryLeft}`, SqlOperator.CUSTOM & SqlOperator.ASSIGN, [])
        } else {
          return e
        }
      })
      script += " "
      script += createUpdateScript(data)
      break
  }

  return script
}

const createDeleteScript = (data: QueryBuilderData) => {
  let script = `DELETE FROM ${data.table}`

  for (let i = 0; i < (data.conditions?.length ?? 0); i++) {
    script += (i === 0) ? "\nWHERE\n  " : " AND\n  "
    script += data.conditions![i].query
  }

  return script
}

export class SQLite3Repository extends DatabaseRepository {
  constructor(
    private _exec: (query: string, values: any[]) => Promise<Record<string, any>[]>,
    private _execUpdate: (query: string, values: any[]) => Promise<unknown> = _exec,
    private _execRaw: (query: string, values: any[]) => Promise<unknown> = _exec,
  ) {
    super()
  }

  select(fields?: ((string | SqlExpr | SqlField) | [(string | SqlExpr | SqlField), string])[] | SQLEntity) {
    return new Selector(createSelectScript, this._exec)
      .select(fields)
  }

  insert() {
    return new Inserter(createUpsertScript, this._execUpdate)
  }

  update(table: string | SQLEntity, alias?: string | undefined) {
    return new Updater(createUpdateScript, this._execUpdate)
      .in(table, alias)
  }

  remove() {
    return new Deleter(createDeleteScript, this._execUpdate)
  }

  async beginTransaction() {
    await this._execRaw("BEGIN TRANSACTION", [])
  }

  async commitTransaction() {
    await this._execRaw("COMMIT", [])
  }

  async rollbackTransaction() {
    await this._execRaw("ROLLBACK", [])
  }

  newId() {
    return ulid()
  }

  exec(query: string, values: any[]) {
    return this._exec(query, values)
  }

  execUpdate(query: string, values: any[]) {
    return this._execUpdate(query, values)
  }
}
