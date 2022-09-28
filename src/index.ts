import { printSchema } from "graphql"
import { mkdir, writeFile } from "node:fs/promises"
import gqlToTs from "./lib/gqlToTs.js"
import { projectDir } from "./lib/moduleDir.js"
import schema from "./schema/schema.js"
import { listen } from "./server.js"

await mkdir(`${projectDir}/data`, { recursive: true })

const schemaAsGQL = printSchema(schema)
await writeFile(`${projectDir}/data/schema.gql`, schemaAsGQL)

const schemaAsTS = gqlToTs(schemaAsGQL)
await writeFile(`${projectDir}/data/schema.gql.ts`, schemaAsTS)

await listen()
