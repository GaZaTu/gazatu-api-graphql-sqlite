import sqlite3 from "better-sqlite3"
import { parentPort, Worker, workerData } from "node:worker_threads"
import { DeSia, Sia } from "sializer"
import { modulePath, projectDir } from "../lib/moduleDir.js"

const sia = Object.assign(new Sia({ size: 0 }), {
  writeString(str: string, offset: number) {
    return (sia.buffer as any).utf8Write(str, offset)
  },
})
const encodeValue = (view: DataView, value: any) => {
  const offset = view.byteLength

  sia.buffer = Buffer.from(view.buffer, offset)
  const encoded = sia.serialize(value)

  view.setUint32(0, encoded.byteLength)
}

const desia = new DeSia({})
const decodeValue = (view: DataView) => {
  const offset = view.byteLength
  const length = view.getUint32(0)

  const buffer = Buffer.from(view.buffer, offset, length)
  const decoded = desia.deserialize(buffer)

  return decoded
}

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
  const sharedBuffer = workerData.sharedBuffer as SharedArrayBuffer
  const sharedBufferView = new DataView(sharedBuffer, 0, 32 / 8)

  parentPort?.on("message", () => {
    let [sql, params] = decodeValue(sharedBufferView) as WorkerMessage
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
      encodeValue(sharedBufferView, result)
      parentPort?.postMessage(undefined)
    }
  })
}

class DatabaseWorker extends Worker {
  private _task?: {
    resolve: (result: any[]) => void
    reject: (error: Error) => void
  }

  private _sharedBufferView: DataView

  constructor() {
    const sharedBuffer = new SharedArrayBuffer(1024 * 1024 * 10) // 10 MB
    const sharedBufferView = new DataView(sharedBuffer, 0, 32 / 8)

    super(modulePath(import.meta.url), {
      workerData: {
        sharedBuffer,
      },
    })

    this._sharedBufferView = sharedBufferView

    this
      .on("message", () => {
        const { resolve, reject } = this._task!
        this._task = undefined

        const [error, data, change] = decodeValue(this._sharedBufferView) as WorkerResult

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
      encodeValue(this._sharedBufferView, message)
      this.postMessage(undefined)
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
