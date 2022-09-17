import { printSchema } from "graphql"
import { mkdir, writeFile } from "node:fs/promises"
import gqlToTs from "./lib/gqlToTs.js"
import moduleDir from "./lib/moduleDir.js"
import schema from "./schema/schema.js"
import { listen } from "./server.js"

const __dirname = moduleDir(import.meta.url)

void (async () => {
  await mkdir(`${__dirname}/../data`, { recursive: true })

  const schemaAsGQL = printSchema(schema)
  await writeFile(`${__dirname}/../data/schema.gql`, schemaAsGQL)

  const schemaAsTS = gqlToTs(schemaAsGQL)
  await writeFile(`${__dirname}/../data/schema.gql.ts`, schemaAsTS)

  await listen()
})().then(console.log, console.error)
