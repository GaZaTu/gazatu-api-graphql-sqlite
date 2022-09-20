import DataLoader from "dataloader"
import { SQLEntity, sqlQuery } from "../lib/querybuilder.js"
import { SchemaContext } from "./schema.js"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getN2MDataLoaderFromContext = <N2M, S extends { id?: any }>({ cache, db }: Pick<SchemaContext, "cache" | "db">, symbol: symbol, childTable: SQLEntity<S>, n2mTable: SQLEntity<N2M>, parentId: keyof N2M, childId: keyof N2M) => {
  let dataloader = cache[symbol] as DataLoader<string, S[]> | undefined
  if (!dataloader) {
    const { query } = sqlQuery`
      SELECT
        ${childTable}.*,
        ${n2mTable.schema[parentId]}
      FROM ${n2mTable}
      JOIN ${childTable} ON ${childTable.schema.id} = ${n2mTable.schema[childId]}
      WHERE ${n2mTable.schema[parentId]} IN ${[...Array(128).keys()]}
    `

    dataloader = new DataLoader(async ids => {
      const filter = ids.slice()
      while (filter.length < 128) {
        filter.push("")
      }

      // const n2m = await db
      //   .select(childTable)
      //   .select([n2mTable.schema[parentId]])
      //   .from(n2mTable)
      //   .join(childTable).on(sql`${childTable.schema.id} = ${n2mTable.schema[childId]}`)
      //   .where(sql`${n2mTable.schema[parentId]} IN ${filter}`)
      //   .findMany(childTable)

      const n2m = await db.exec(query, filter) as S[]

      return ids
        .map(id => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return n2m.filter(s => (s as any)[parentId] === id)
        })
    }, { maxBatchSize: 128 })
    cache[symbol] = dataloader
  }

  return dataloader
}

export default getN2MDataLoaderFromContext
