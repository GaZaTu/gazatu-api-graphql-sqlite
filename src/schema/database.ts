import fastq from "fastq"
import EventEmitter from "node:events"
import { readdir, readFile } from "node:fs/promises"
import os from "node:os"
import { projectDir } from "../lib/moduleDir.js"
import { SQLite3Access } from "../lib/querybuilder-sqlite.js"
import { createCreateFTSSyncTriggersN2MScript, createCreateFTSSyncTriggersScript } from "../lib/sqlite-createftssynctriggers.js"
import { createCreateISOTimestampTriggersScript } from "../lib/sqlite-createisotimestamptriggers.js"
import DatabaseWorker, { openDatabase, WorkerMessage, WorkerResult } from "./DatabaseWorker.js"

const setupDatabase = async () => {
  const database = openDatabase()

  const macroCalls = [] as ((db: typeof database) => void)[]

  try {
    database.function("__CREATE_FTS_SYNC_TRIGGERS", (srcTable, ftsTable) => {
      macroCalls.push(database => {
        const tableInfo = database.pragma(`table_info('${ftsTable}')`) as any[]
        const fields = tableInfo.map(f => f.name)

        const script = createCreateFTSSyncTriggersScript(srcTable, ftsTable, fields)
        database.exec(script)
      })
    })

    database.function("__CREATE_FTS_SYNC_TRIGGERS_N2M", (srcTable, ftsTable, n2mTable, srcId, n2mId) => {
      macroCalls.push(database => {
        const tableInfo = database.pragma(`table_info('${ftsTable}')`) as any[]
        const fields = tableInfo.map(f => f.name)

        const script = createCreateFTSSyncTriggersN2MScript(srcTable, ftsTable, n2mTable, srcId, n2mId, fields)
        database.exec(script)
      })
    })

    database.function("__CREATE_ISO_TIMESTAMP_TRIGGERS", (table, column) => {
      macroCalls.push(database => {
        const script = createCreateISOTimestampTriggersScript(table, column)
        database.exec(script)
      })
    })

    const migrationsDir = `${projectDir}/migrations`

    let version = database.pragma("user_version", { simple: true }) as number
    for (const scriptPath of await readdir(migrationsDir)) {
      const scriptVersion = Number(/v(\d+).sql/.exec(scriptPath)![1])
      if (scriptVersion <= version) {
        continue
      }

      const script = await readFile(`${migrationsDir}/${scriptPath}`, { encoding: "utf-8" })

      console.log(`updating database from v${version} to v${scriptVersion}`)

      database.transaction(() => {
        database.exec(script)

        for (const macroCall of macroCalls) {
          macroCall(database)
        }

        database.pragma(`user_version = ${version = scriptVersion}`)
      })()
    }

    database.pragma("wal_checkpoint(PASSIVE)")
    database.pragma("optimize")
  } finally {
    database.close()
  }
}

const workers = [] as DatabaseWorker[]
const spawnWorker = async () => {
  const worker = new DatabaseWorker()

  await new Promise((resolve, reject) => {
    worker
      .on("online", resolve)
      .on("error", reject)
  })

  worker
    .on("exit", code => {
      const workerIndex = workers.findIndex(w => w === worker)
      workers.splice(workerIndex, 1)

      if (code !== 0) {
        console.error(`worker #${workerIndex} exited with code ${code}`)
        spawnWorker() // Worker died, so spawn a new one
      }
    })
    .on("change", (ev: NonNullable<WorkerResult["change"]>) => {
      databaseHooks.emit("change", ev)
    })

  workers.push(worker)
}

await setupDatabase()
for (const {} of os.cpus()) {
  await spawnWorker()
}

const work = (task: WorkerMessage) => {
  const worker = workers.find(w => !w.inUse)
  if (!worker) {
    throw new Error("No unused DatabaseWorker found")
  }

  return worker.all(task)
}

const queue = fastq.promise(work, workers.length)
const all = (sql: string, params: any[]) => {
  return queue.push({ sql, params })
}

const database = new SQLite3Access(all)
export default database

export type DatabaseChangeHook = (ev: NonNullable<WorkerResult["change"]>) => void
export const databaseHooks = new EventEmitter() as EventEmitter & {
  emit(event: "change", ...args: Parameters<DatabaseChangeHook>): void
  on(event: "change", listener: DatabaseChangeHook): void
}

setInterval(() => {
  database.exec("PRAGMA optimize", [])
}, 1000 * 60 * 60 * 24)
