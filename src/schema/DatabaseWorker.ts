import sqlite3 from "better-sqlite3"
import { parentPort, Worker } from "node:worker_threads"
import { modulePath, projectDir } from "../lib/moduleDir.js"

export type WorkerMessage = [
  sql: string,
  params: any[],
]

export type WorkerResult = [
  error?: any,
  data?: [
    rows: any[][],
    cols: string[],
  ],
  change?: [
    type: "INSERT" | "UPDATE" | "DELETE",
    table: string,
  ],
]

export const openDatabase = () => {
  const databaseFile = (() => {
    if (process.env.NODE_ENV === "test") {
      return ":memory:"
    }

    return `${projectDir}/data/database.sqlite3`
  })()

  const database = sqlite3(databaseFile)
  database.pragma("journal_mode = wal")
  database.pragma("synchronous = normal")
  database.pragma("wal_autocheckpoint = 512")
  database.pragma("trusted_schema = ON")
  database.pragma("foreign_keys = ON")
  // database.pragma("analysis_limit = 512")

  return database
}

const database = openDatabase()

const sqlInsertRegex = /^INSERT\sINTO\s"?(\w+)"?/
const sqlUpdateRegex = /^UPDATE\s"?(\w+)"?/
const sqlDeleteRegex = /^DELETE\sFROM\s"?(\w+)"?/

if (parentPort) {
  parentPort?.on("message", (message: WorkerMessage) => {
    let [sql, params] = message
    const result: WorkerResult = []

    try {
      sql = sql.trimStart()
      params = params.map(p => {
        if (typeof p === "boolean") {
          return p ? 1 : 0
        } else {
          return p
        }
      })

      const statement = database.prepare(sql)

      const isSelect = sql.startsWith("SELECT")

      if (isSelect) {
        result[1] = [
          statement.raw().all(...params),
          statement.columns().map(c => c.name),
        ]
      } else {
        result[1] = [
          [[statement.run(...params)]],
          ["RunResult"],
        ]

        const isInsert = sql.startsWith("INSERT")
        const isUpdate = sql.startsWith("UPDATE")
        const isDelete = sql.startsWith("DELETE")

        if (isInsert || isUpdate || isDelete) {
          const [type, regex] = (() => {
            if (isInsert) return ["INSERT", sqlInsertRegex] as const
            if (isUpdate) return ["UPDATE", sqlUpdateRegex] as const
            if (isDelete) return ["DELETE", sqlDeleteRegex] as const
            throw new Error()
          })()

          if (regex) {
            const [, table] = regex.exec(sql)!
            result[2] = [type, table]
          }
        }
      }
    } catch (error: any) {
      if (typeof error === "object") {
        result[0] = {
          ...error,
          message: error.message,
        }
      } else {
        result[0] = error
      }
    } finally {
      parentPort?.postMessage(result)
    }
  })
}

class DatabaseWorker extends Worker {
  private _task?: {
    resolve: (result: any[]) => void
    reject: (error: Error) => void
  }

  constructor() {
    super(modulePath(import.meta.url))

    this
      .on("message", (result: WorkerResult) => {
        const { resolve, reject } = this._task!
        this._task = undefined

        const [error, data, change] = result

        if (error) {
          if (typeof error === "object") {
            return reject(Object.assign(new Error(), error))
          }

          return reject(error)
        }

        if (change) {
          this.emit("change", {
            type: change[0],
            table: change[1],
          })
        }

        const cols = data![1]
        const rows = data![0].map(row => {
          return row.reduce((r, c, i) => { r[cols[i]] = c; return r }, {} as Record<string, any>)
        })

        return resolve(rows)
      })
  }

  all(...message: WorkerMessage) {
    return new Promise<any[]>((resolve, reject) => {
      this._task = { resolve, reject }
      this.postMessage(message)
    })
  }

  get inUse() {
    return !!this._task
  }
}

export default DatabaseWorker

interface DatabaseWorker {
  on(event: "change", listener: (event: { type: string, table: string }) => void): this
  on(event: "error", listener: (err: Error) => void): this
  on(event: "exit", listener: (exitCode: number) => void): this
  on(event: "message", listener: (value: any) => void): this
  on(event: "messageerror", listener: (error: Error) => void): this
  on(event: "online", listener: () => void): this
  on(event: string | symbol, listener: (...args: any[]) => void): this
}
