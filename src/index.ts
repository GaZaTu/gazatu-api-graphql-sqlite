import { printSchema } from "graphql"
import { mkdir, writeFile } from "node:fs/promises"
import gqlToTs from "./lib/gqlToTs.js"
import { projectDir } from "./lib/moduleDir.js"
import schema from "./schema/schema.js"
import useDatabaseApi from "./schema/useDatabaseApi.js"
import { listen } from "./server.js"

void (async () => {
  await mkdir(`${projectDir}/data`, { recursive: true })

  const schemaAsGQL = printSchema(schema)
  await writeFile(`${projectDir}/data/schema.gql`, schemaAsGQL)

  const schemaAsTS = gqlToTs(schemaAsGQL)
  await writeFile(`${projectDir}/data/schema.gql.ts`, schemaAsTS)

  await (async () => {
    const db = await useDatabaseApi()
    await db.exec("PRAGMA wal_checkpoint(PASSIVE)", [])
  })()

  await listen()
})().then(console.log, console.error)
