/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-explicit-any */

import Dataloader from "dataloader"

export enum SqlOperator {
  CUSTOM = 1 << 1,

  AND = 1 << 2,
  OR = 1 << 3,

  NOT = 1 << 4,

  EQ = 1 << 5,
  NEQ = 1 << 6,

  LT = 1 << 7,
  LTEQ = 1 << 8,

  GT = 1 << 9,
  GTEQ = 1 << 10,

  ISNULL = 1 << 11,
  ISNOTNULL = 1 << 12,

  IN = 1 << 13,

  ASSIGN = 1 << 14,
}

const stringifySqlOperator = (value: SqlOperator) => {
  switch (value) {
    case SqlOperator.AND:
      return " AND "
    case SqlOperator.OR:
      return " OR "
    case SqlOperator.NOT:
      return "NOT "
    case SqlOperator.EQ:
      return " = "
    case SqlOperator.NEQ:
      return " != "
    case SqlOperator.LT:
      return " < "
    case SqlOperator.LTEQ:
      return " <= "
    case SqlOperator.GT:
      return " > "
    case SqlOperator.GTEQ:
      return " >= "
    case SqlOperator.ISNULL:
      return " IS NULL"
    case SqlOperator.ISNOTNULL:
      return " IS NOT NULL"
    case SqlOperator.IN:
      return " IN "
    case SqlOperator.ASSIGN:
      return " = "
    default:
      return ""
  }
}

type OrderByDirection = "ASC" | "DESC"

type OrderByNulls = "NULLS FIRST" | "NULLS LAST"

type JoinMode = "INNER JOIN" | "LEFT JOIN" | "CROSS JOIN"

interface HasQuery {
  readonly query: string
}

interface HasValues {
  readonly values: any[]
}

export class SqlExpr<L = any, O extends SqlOperator = SqlOperator, R = any> implements HasQuery, HasValues {
  constructor(
    private _left: L,
    private _operator: O,
    private _right: R,
  ) { }

  get operator() {
    return this._operator
  }

  get queryLeft() {
    let query = ""

    if ((this._operator | SqlOperator.CUSTOM) === SqlOperator.CUSTOM) {
      if (typeof this._left === "function") {
        query += (this._left as unknown as (() => string))()
      } else {
        query += `${this._left}`
      }
    } else if (this._operator === SqlOperator.NOT) {
    } else if (this._left instanceof SqlField || this._left instanceof SqlExpr) {
      if (((this._operator | SqlOperator.ASSIGN) === SqlOperator.ASSIGN) && (this._left instanceof SqlField)) {
        query += this._left.name
      } else {
        query += this._left.query
      }
    }

    return query
  }

  get queryRight() {
    let query = ""

    if (this._right instanceof SqlField || this._right instanceof SqlExpr) {
      query += this._right.query
    } else if (this._right === null || this._right === undefined) {
    } else if ((this._operator | SqlOperator.CUSTOM) === SqlOperator.CUSTOM) {
    } else if (Array.isArray(this._right)) {
      query += `(${[...this._right].map(() => "?").join(",") })`
    } else {
      query += "?"
    }

    return query
  }

  get query() {
    let query = ""

    if ((this._operator | SqlOperator.ASSIGN) !== SqlOperator.ASSIGN) {
      query += "("
    }

    query += this.queryLeft
    query += stringifySqlOperator(this._operator)
    query += this.queryRight

    if ((this._operator | SqlOperator.ASSIGN) !== SqlOperator.ASSIGN) {
      query += ")"
    }

    return query
  }

  get values() {
    let params = [] as any[]

    if (this._left instanceof SqlExpr) {
      params = [...params, ...this._left.values]
    }

    if (this._right instanceof SqlExpr) {
      params = [...params, ...this._right.values]
    } else if (this._right instanceof SqlField) {
    // eslint-disable-next-line no-empty
    } else if (this._operator === SqlOperator.ISNULL || this._operator === SqlOperator.ISNOTNULL) {
    // eslint-disable-next-line no-empty
    } else if ((this._operator | SqlOperator.CUSTOM) === SqlOperator.CUSTOM) {
      if (typeof this._right === "function") {
        params = [...params, ...(this._right as unknown as (() => any[]))()]
      } else {
        params = [...params, ...(this._right as any)]
      }
    } else if (Array.isArray(this._right)) {
      params = [...params, ...this._right]
    } else {
      params = [...params, this._right]
    }

    return params
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export class SqlField<T = any> extends SqlExpr {
  constructor(
    private _name: string,
    private _source?: string,
  ) {
    super(null, SqlOperator.CUSTOM, null)
  }

  get name() {
    return `"${this._name}"`
  }

  get queryLeft(): string {
    return this.name
  }

  get queryRight(): string {
    return ""
  }

  get query() {
    let query = ""
    if (this._source) {
      query += `${this._source}.`
    }
    query += `"${this._name}"`
    return query
  }

  get values() {
    return []
  }
}

export const AND = (...conditions: SqlExpr[]) => {
  let current = conditions[0]
  for (const condition of conditions.slice(1)) {
    current = new SqlExpr(current, SqlOperator.AND, condition)
  }

  return current
}
export const OR = (...conditions: SqlExpr[]) => {
  let current = conditions[0]
  for (const condition of conditions.slice(1)) {
    current = new SqlExpr(current, SqlOperator.OR, condition)
  }

  return current
}

export const NOT = (c1: SqlField | SqlExpr) => {
  return new SqlExpr(undefined as undefined, SqlOperator.NOT, c1)
}

export const EQ = <T>(field: SqlField<T> | SqlExpr, value: T | SqlField | SqlExpr | null | undefined) => {
  return new SqlExpr(field, (value !== null || value !== undefined) ? SqlOperator.EQ : SqlOperator.ISNULL, value)
}
export const NEQ = <T>(field: SqlField<T> | SqlExpr, value: T | SqlField | SqlExpr | null | undefined) => {
  return new SqlExpr(field, (value !== null || value !== undefined) ? SqlOperator.NEQ : SqlOperator.ISNOTNULL, value)
}

export const LT = <T>(field: SqlField<T> | SqlExpr, value: T | SqlField | SqlExpr) => {
  return new SqlExpr(field, SqlOperator.LT, value)
}
export const LTEQ = <T>(field: SqlField<T> | SqlExpr, value: T | SqlField | SqlExpr) => {
  return new SqlExpr(field, SqlOperator.LTEQ, value)
}

export const GT = <T>(field: SqlField<T> | SqlExpr, value: T | SqlField | SqlExpr) => {
  return new SqlExpr(field, SqlOperator.GT, value)
}
export const GTEQ = <T>(field: SqlField<T> | SqlExpr, value: T | SqlField | SqlExpr) => {
  return new SqlExpr(field, SqlOperator.GTEQ, value)
}

export const ISNULL = (field: SqlField | SqlExpr) => {
  return new SqlExpr(field, SqlOperator.ISNULL, undefined as undefined)
}
export const ISNOTNULL = (field: SqlField | SqlExpr) => {
  return new SqlExpr(field, SqlOperator.ISNOTNULL, undefined as undefined)
}

export const IN = <T>(field: SqlField<T>, value: T[] | SqlExpr) => {
  return new SqlExpr(field, SqlOperator.IN, value)
}

export const ASSIGN = <T>(field: SqlField<T>, value: T | SqlField | SqlExpr | null | undefined) => {
  return new SqlExpr(field, SqlOperator.ASSIGN, value)
}

class QuerySelection {
  constructor(
    public readonly name: (string | SqlExpr | SqlField),
    public readonly alias?: string,
  ) { }

  static from(field: (string | SqlExpr | SqlField) | [(string | SqlExpr | SqlField), string]) {
    if (Array.isArray(field)) {
      return new this(...field)
    } else {
      return new this(field)
    }
  }

  toString() {
    let name = this.name
    let quote = false

    if (typeof this.name === "string") {
      quote = /^[A-Z]$/i.test(this.name[0])
      for (const c of this.name) {
        if (!/^[a-zA-Z0-9-]$/i.test(c)) {
          quote = false
          break
        }
      }
    } else {
      name = this.name.query
    }

    let result = `${quote ? "\"" : ""}${name}${quote ? "\"" : ""}`
    if (this.alias) {
      result += ` AS "${this.alias}"`
    }

    return result
  }
}

type QueryBuilderJoinClause = {
  table: QuerySelection
  condition?: SqlExpr
  mode?: JoinMode
}

type QueryBuilderOrderClause = {
  field: SqlExpr
  direction?: OrderByDirection
  nulls?: OrderByNulls
}

export enum QueryBuilderUpsertMode {
  DISABLED,
  NOTHING,
  UPDATE,
  MERGE,
}

export type QueryBuilderData = {
  table?: QuerySelection
  fields?: QuerySelection[]
  joins?: QueryBuilderJoinClause[]
  assignments?: SqlExpr[]
  conditions?: SqlExpr[]
  groupings?: SqlField[]
  groupingConditions?: SqlExpr[]
  ordering?: QueryBuilderOrderClause[]
  offset?: number
  limit?: number
  upsert?: QueryBuilderUpsertMode
  distinct?: boolean
}

const getTableName = (table: string | SQLEntity) => {
  if (typeof table === "string") {
    return table
  } else if (isSQLEntity(table)) {
    return table.entityName
  } else {
    return (table as any).name
  }
}

export class Selector implements HasQuery, HasValues {
  private _data: QueryBuilderData = {}

  static JoinHandler = class {
    constructor(
      private _selector: Selector,
      private _clause: QueryBuilderJoinClause,
    ) { }

    inner() {
      this._clause.mode = "INNER JOIN"

      return this
    }

    left() {
      this._clause.mode = "LEFT JOIN"

      return this
    }

    cross() {
      this._clause.mode = "CROSS JOIN"

      return this
    }

    on(condition?: SqlExpr | (HasQuery & HasValues)) {
      if (!condition) {
        return this._selector
      }

      if (!(condition instanceof SqlExpr)) {
        condition = new SqlExpr(condition.query, SqlOperator.CUSTOM, condition.values)
      }

      this._clause.condition = condition as SqlExpr
      this._clause.mode ??= "INNER JOIN"

      return this._selector
    }

    always() {
      return this.on(new SqlExpr("1 = 1", SqlOperator.CUSTOM, []))
    }
  }

  constructor(
    private _createScript: (data: QueryBuilderData) => string,
    private _exec: (query: string, values: any[]) => Promise<Record<string, any>[]>,
  ) { }

  select(fields?: ((string | SqlExpr | SqlField) | [(string | SqlExpr | SqlField), string])[] | SQLEntity) {
    if (!fields) {
      return this
    }

    if (isSQLEntity(fields)) {
      fields = [`${fields.entityName}.*`]
    }

    this._data.fields = [...(this._data.fields ?? []), ...fields.map(f => QuerySelection.from(f))]

    return this
  }

  distinct(distinct = true) {
    this._data.distinct = distinct

    return this
  }

  from(table: string | SQLEntity | SqlExpr, alias?: string) {
    this._data.table = new QuerySelection((table instanceof SqlExpr) ? table : getTableName(table), alias)

    return this
  }

  join(table: string | SQLEntity | SqlExpr, alias?: string) {
    const clause: QueryBuilderJoinClause = {
      table: new QuerySelection((table instanceof SqlExpr) ? table : getTableName(table), alias),
    }

    this._data.joins = [...(this._data.joins ?? []), clause]

    return new Selector.JoinHandler(this, clause)
  }

  where(condition?: SqlExpr | (HasQuery & HasValues)) {
    if (!condition) {
      return this
    }

    if (!(condition instanceof SqlExpr)) {
      condition = new SqlExpr(condition.query, SqlOperator.CUSTOM, condition.values)
    }

    this._data.conditions = [...(this._data.conditions ?? []), condition as SqlExpr]

    return this
  }

  groupBy(field: string | SqlField) {
    this._data.groupings = [...(this._data.groupings ?? []), (field instanceof SqlField) ? field : new SqlField(field)]

    return this
  }

  having(condition?: SqlExpr | (HasQuery & HasValues)) {
    if (!condition) {
      return this
    }

    if (!(condition instanceof SqlExpr)) {
      condition = new SqlExpr(condition.query, SqlOperator.CUSTOM, condition.values)
    }

    this._data.groupingConditions = [...(this._data.groupingConditions ?? []), condition as SqlExpr]

    return this
  }

  orderBy(field: string | SqlField | SqlExpr, direction?: OrderByDirection, nulls?: OrderByNulls) {
    const clause: QueryBuilderOrderClause = {
      field: (typeof field === "string") ? new SqlField(field) : field,
      direction,
      nulls,
    }

    this._data.ordering = [...(this._data.ordering ?? []), clause]

    return this
  }

  offset(offset: number | undefined) {
    this._data.offset = offset

    return this
  }

  limit(limit: number | undefined) {
    this._data.limit = limit

    return this
  }

  get query() {
    return this._createScript(this._data)
  }

  get values() {
    const values = [] as any[]

    for (const field of this._data.fields ?? []) {
      if (field.name instanceof SqlExpr) {
        values.push(...field.name.values)
      }
    }

    for (const join of this._data.joins ?? []) {
      if (join.table.name instanceof SqlExpr) {
        values.push(...join.table.name.values)
      }

      if (join.condition) {
        values.push(...join.condition.values)
      }
    }

    for (const condition of this._data.conditions ?? []) {
      values.push(...condition.values)
    }

    for (const condition of this._data.groupingConditions ?? []) {
      values.push(...condition.values)
    }

    return values
  }

  async findMany<T extends Record<string, any> = Record<string, any>>(constructor?: SQLEntity<T>) {
    if (constructor) {
      // this._data.table ??= new QuerySelection(constructor.name)
      // this._data.fields ??= Object.keys(constructor.prototype).map(k => new QuerySelection(k))
    }

    this._data.fields ??= [new QuerySelection(this._data.table?.alias ? `${this._data.table.alias}.*` : "*")]

    const result = await this._exec(this.query, this.values)

    if (constructor) {
      return result.map(r => constructor.coerce(r))
    }

    return result as T[]
  }

  async findOne<T extends Record<string, any> = Record<string, any>>(constructor?: SQLEntity<T>) {
    this.limit(1)

    const result = await this.findMany(constructor)
    return result[0] as T | undefined
  }

  async findFirstValue<T>() {
    const result = await this.findOne()
    for (const value of Object.values(result ?? {})) {
      return value as T
    }
    return undefined
  }

  then<TResult1 = Record<string, any>, TResult2 = never>(onfulfilled?: ((value: Record<string, any>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    return this.findMany()
      .then(onfulfilled, onrejected)
  }

  asCount() {
    this._data.fields = [new QuerySelection("count(*)")]

    const script = `${this._createScript(this._data)}`
    return new SqlExpr(script, SqlOperator.CUSTOM, [])
  }

  count() {
    this._data.fields = [new QuerySelection("count(*)")]

    return this
      .findFirstValue<number>()
  }

  asExists() {
    this._data.fields = [new QuerySelection("1")]

    const script = `EXISTS (${this._createScript(this._data)})`
    return new SqlExpr(script, SqlOperator.CUSTOM, [])
  }

  exists() {
    return new Selector(this._createScript, this._exec)
      .select([this.asExists()])
      .findFirstValue<boolean>()
  }

  asExpr() {
    const script = this._createScript(this._data)
    return new SqlExpr(script, SqlOperator.CUSTOM, [])
  }
}

export class Inserter implements HasQuery, HasValues {
  private _data: QueryBuilderData = {}

  static OnConflictHandler = class {
    constructor(
      private _inserter: Inserter,
    ) { }

    doNothing() {
      this._inserter._data.upsert = QueryBuilderUpsertMode.NOTHING

      return this._inserter
    }

    doMerge() {
      this._inserter._data.upsert = QueryBuilderUpsertMode.MERGE

      return this._inserter
    }
  }

  constructor(
    private _createScript: (data: QueryBuilderData) => string,
    private _exec: (query: string, values: any[]) => Promise<unknown>,
  ) { }

  into(table: string | SQLEntity) {
    this._data.table = new QuerySelection(getTableName(table))

    return this
  }

  set<T = any>(assignment?: SqlExpr[] | (HasQuery & HasValues) | SqlField<T> | string | Record<string, any>, value?: T) {
    if (!assignment) {
      return this
    }

    if (!Array.isArray(assignment)) {
      if (typeof assignment === "string") {
        assignment = [new SqlExpr(new SqlField(assignment), SqlOperator.ASSIGN, value)]
      } else if (assignment instanceof SqlField) {
        assignment = [new SqlExpr(assignment, SqlOperator.ASSIGN, value)]
      } else if (assignment instanceof SqlExpr) {
        assignment = [assignment]
      } else if (Object.getPrototypeOf(assignment).query) {
        assignment = [new SqlExpr(assignment.query, SqlOperator.CUSTOM, assignment.values)]
      } else {
        assignment = Object.entries(assignment).map(([key, value]) => new SqlExpr(new SqlField(key), SqlOperator.ASSIGN, value))
      }
    }

    this._data.assignments = [...(this._data.assignments ?? []), ...(assignment as SqlExpr[])]

    return this
  }

  onConflict(fields?: string[]) {
    this._data.fields = fields?.map(f => new QuerySelection(f))

    return new Inserter.OnConflictHandler(this)
  }

  get query() {
    return this._createScript(this._data)
  }

  get values() {
    const values = [] as any[]

    for (const assignment of this._data.assignments ?? []) {
      values.push(...assignment.values)
    }

    return values
  }

  execute() {
    const result = this._exec(this.query, this.values)
    return result
  }

  then<TResult1 = unknown, TResult2 = never>(onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    return this.execute()
      .then(onfulfilled, onrejected)
  }
}

export class Updater implements HasQuery, HasValues {
  private _data: QueryBuilderData = {}

  constructor(
    private _createScript: (data: QueryBuilderData) => string,
    private _exec: (query: string, values: any[]) => Promise<unknown>,
  ) { }

  in(table: string | SQLEntity, alias?: string) {
    this._data.table = new QuerySelection(getTableName(table), alias)

    return this
  }

  set<T = any>(assignment?: SqlExpr[] | SqlExpr | (HasQuery & HasValues) | SqlField<T> | string | Record<string, any>, value?: T) {
    if (!assignment) {
      return this
    }

    if (!Array.isArray(assignment)) {
      if (typeof assignment === "string") {
        assignment = [new SqlExpr(new SqlField(assignment), SqlOperator.ASSIGN, value)]
      } else if (assignment instanceof SqlField) {
        assignment = [new SqlExpr(assignment, SqlOperator.ASSIGN, value)]
      } else if (assignment instanceof SqlExpr) {
        assignment = [assignment]
      } else if (Object.getPrototypeOf(assignment).query) {
        assignment = [new SqlExpr(assignment.query, SqlOperator.CUSTOM, assignment.values)]
      } else {
        assignment = Object.entries(assignment).map(([key, value]) => new SqlExpr(new SqlField(key), SqlOperator.ASSIGN, value))
      }
    }

    this._data.assignments = [...(this._data.assignments ?? []), ...(assignment as SqlExpr[])]

    return this
  }

  where(condition?: SqlExpr | (HasQuery & HasValues)) {
    if (!condition) {
      return this
    }

    if (!(condition instanceof SqlExpr)) {
      condition = new SqlExpr(condition.query, SqlOperator.CUSTOM, condition.values)
    }

    this._data.conditions = [...(this._data.conditions ?? []), condition as SqlExpr]

    return this
  }

  get query() {
    return this._createScript(this._data)
  }

  get values() {
    const values = [] as any[]

    for (const assignment of this._data.assignments ?? []) {
      values.push(...assignment.values)
    }

    for (const condition of this._data.conditions ?? []) {
      values.push(...condition.values)
    }

    return values
  }

  execute() {
    const result = this._exec(this.query, this.values)
    return result
  }

  then<TResult1 = unknown, TResult2 = never>(onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    return this.execute()
      .then(onfulfilled, onrejected)
  }
}

export class Deleter implements HasQuery, HasValues {
  private _data: QueryBuilderData = {}

  constructor(
    private _createScript: (data: QueryBuilderData) => string,
    private _exec: (query: string, values: any[]) => Promise<unknown>,
  ) { }

  from(table: string | SQLEntity, alias?: string) {
    this._data.table = new QuerySelection(getTableName(table), alias)

    return this
  }

  where(condition?: SqlExpr | (HasQuery & HasValues)) {
    if (!condition) {
      return this
    }

    if (!(condition instanceof SqlExpr)) {
      condition = new SqlExpr(condition.query, SqlOperator.CUSTOM, condition.values)
    }

    this._data.conditions = [...(this._data.conditions ?? []), condition as SqlExpr]

    return this
  }

  get query() {
    return this._createScript(this._data)
  }

  get values() {
    const values = [] as any[]

    for (const assignment of this._data.assignments ?? []) {
      values.push(...assignment.values)
    }

    for (const condition of this._data.conditions ?? []) {
      values.push(...condition.values)
    }

    return values
  }

  execute() {
    const result = this._exec(this.query, this.values)
    return result
  }

  then<TResult1 = unknown, TResult2 = never>(onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    return this.execute()
      .then(onfulfilled, onrejected)
  }
}

export const sql = (strings: TemplateStringsArray, ..._values: any[]) => {
  const query = strings
    .reduce((prev, curr, i) => {
      const value: any = _values[i - 1]

      if (value instanceof SqlField || value instanceof SqlExpr) {
        return `${prev}${value.query}${curr}`
      }

      if (Array.isArray(value)) {
        return `${prev}(${value.map(() => "?").join(", ")})${curr}`
      }

      return `${prev}?${curr}`
    })

  const values = _values
    .flatMap(value => {
      if (value instanceof SqlField) {
        return []
      }

      if (value instanceof SqlExpr) {
        return value.values
      }

      if (Array.isArray(value)) {
        return value
      }

      return [value]
    })

  const expr = new SqlExpr(query, SqlOperator.CUSTOM, values)
  return expr
}

export const sqlField = (strings: TemplateStringsArray) => {
  const [source, name] = strings[0].split(".")

  if (name) {
    return new SqlField(name, source)
  } else {
    return new SqlField(source)
  }
}

export abstract class DatabaseRepository {
  abstract select(fields?: ((string | SqlExpr | SqlField) | [(string | SqlExpr | SqlField), string])[] | SQLEntity): Selector

  abstract insert(): Inserter

  abstract update(table: string | SQLEntity, alias?: string | undefined): Updater

  abstract remove(): Deleter

  abstract beginTransaction(): void

  abstract commitTransaction(): void

  abstract rollbackTransaction(): void

  abstract newId(): string | number

  abstract exec(query: string, values: any[]): Promise<Record<string, any>[]>

  private _dataloaders = new Map<string | SQLEntity, Dataloader<string, any>>()

  of<T extends Record<string, any> = Record<string, any>>(table: string | SQLEntity<T>) {
    const count = (condition?: SqlExpr) => {
      return this
        .select(["count(*)"])
        .from(table)
        .where(condition)
        .findFirstValue<number>()
    }

    const findId = (condition: SqlExpr) => {
      return this
        .select(["id"])
        .from(table)
        .where(condition)
        .findFirstValue<string | number>()
    }

    const findMany = (condition?: SqlExpr) => {
      return this
        .select()
        .from(table)
        .where(condition)
        .findMany<T>(typeof table !== "string" ? table : undefined)
    }

    const findManyById = (ids: (string | number | null | undefined)[]) => {
      return findMany(IN(sqlField`id`, ids))
    }

    const findOne = (condition: SqlExpr) => {
      return this
        .select()
        .from(table)
        .where(condition)
        .findOne<T>(typeof table !== "string" ? table : undefined)
    }

    const findOneById = (id: string | number | null | undefined) => {
      return findOne(EQ(sqlField`id`, id))
    }

    const dataloader = (() => {
      let dataloader = this._dataloaders.get(table)
      if (!dataloader) {
        dataloader = new Dataloader(async ids => {
          console.log("DATALOADER", ids)

          const map = new Map(
            (await findManyById(ids as any[]))
              .map(r => [r["id"], r] as const)
          )

          return ids
            .map(id => map.get(id))
        })

        this._dataloaders.set(table, dataloader)
      }

      return dataloader
    })()

    const findOneByIdWithDataloader: (typeof findOneById) = async id => {
      return await dataloader.load(id as any)
    }

    const exists = async (condition: SqlExpr) => {
      const r = await findOne(condition)
      return r !== undefined
    }

    const existsById = (id: string | number | null | undefined) => {
      return exists(EQ(sqlField`id`, id))
    }

    const save = async (objects: Partial<T> | Partial<T>[] | undefined) => {
      if (!objects) {
        return []
      }

      if (!Array.isArray(objects)) {
        objects = [objects]
      }

      for (const object of objects) {
        if (!object.id) {
          Object.assign(object, {
            id: this.newId(),
          })
        }

        const qb = this.insert()
          .into(table)
          .onConflict(["id"]).doMerge()

        for (const [key, value] of Object.entries(object)) {
          if (key.startsWith("_") || value === undefined) {
            continue
          }

          qb.set(ASSIGN(new SqlField(key), value))
        }

        await qb.execute()
        Object.assign(object, await findOneByIdWithDataloader(object.id as any))
      }

      return objects as T[]
    }

    const removeMany = (condition?: SqlExpr) => {
      return this
        .remove()
        .from(table)
        .where(condition)
        .execute()
    }

    const removeManyById = (ids: (string | number)[]) => {
      return removeMany(IN(sqlField`id`, ids))
    }

    const removeOneById = (id: string | number) => {
      return removeMany(EQ(sqlField`id`, id))
    }

    const remove = async (objects: Partial<T> | Partial<T>[] | undefined) => {
      if (!objects) {
        return
      }

      if (!Array.isArray(objects)) {
        objects = [objects]
      }

      for (const object of objects) {
        if (!object.id) {
          continue
        }

        await removeOneById(object.id as any)
      }
    }

    const enableMany = (field: SqlField, condition?: SqlExpr) => {
      return this
        .update(table)
        .set(ASSIGN(field, true))
        .where(condition)
        .execute()
    }

    const enableManyById = (field: SqlField, ids: (string | number)[]) => {
      return enableMany(field, IN(sqlField`id`, ids))
    }

    const enableOneById = (field: SqlField, id: string | number) => {
      return enableMany(field, EQ(sqlField`id`, id))
    }

    const enable = async (field: SqlField, objects: Partial<T> | Partial<T>[] | undefined) => {
      if (!objects) {
        return
      }

      if (!Array.isArray(objects)) {
        objects = [objects]
      }

      for (const object of objects) {
        if (!object.id) {
          continue
        }

        await enableOneById(field, object.id as any)
      }
    }

    return {
      count,
      findId,
      findMany,
      findManyById,
      findOne,
      findOneById: findOneByIdWithDataloader,
      exists,
      existsById,
      save,
      removeMany,
      removeManyById,
      removeOneById,
      remove,
      enableMany,
      enableManyById,
      enableOneById,
      enable,
    }
  }

  private _inTransaction = false
  private _onTransactionCommit = undefined as (undefined | (() => unknown))

  transaction<T>(handler: (repo: this) => T): T
  transaction<T>(handler: (repo: this) => Promise<T>): Promise<T>
  transaction<T>(handler: (repo: this) => T | Promise<T>): T | Promise<T> {
    let potentialPromise: T | Promise<T> | undefined = undefined

    this.beginTransaction()
    this._inTransaction = true
    try {
      potentialPromise = handler(this)

      if (potentialPromise instanceof Promise) {
        return (async () => {
          try {
            await potentialPromise

            this.commitTransaction()

            this._onTransactionCommit?.()
            this._onTransactionCommit = undefined

            return potentialPromise
          } catch (error) {
            this.rollbackTransaction()
            throw error
          } finally {
            this._inTransaction = false
          }
        })()
      } else {
        this.commitTransaction()

        this._onTransactionCommit?.()
        this._onTransactionCommit = undefined

        return potentialPromise
      }
    } catch (error) {
      this.rollbackTransaction()
      throw error
    } finally {
      if (!(potentialPromise instanceof Promise)) {
        this._inTransaction = false
      }
    }
  }

  get inTransaction() {
    return this._inTransaction
  }

  set onTransactionCommit(handler: () => unknown) {
    this._onTransactionCommit = handler
  }
}

export type SQLEntity<T = any> = {
  entityName: string
  coerce: (r: Record<string, any>) => T
}

export const isSQLEntity = (v: any): v is SQLEntity => {
  return !!v.entityName
}
