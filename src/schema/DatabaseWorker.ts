import sqlite3 from "better-sqlite3"
import { parentPort, Worker, workerData } from "node:worker_threads"
import { DeSia, Sia } from "sializer"
import { modulePath, projectDir } from "../lib/moduleDir.js"

const sia = new Sia({ size: 0 })
const encodeValue = (view: DataView, value: any) => {
  const offset = view.byteLength

  const buffer = Buffer.from(view.buffer, offset)
  Object.assign(sia, { buffer })
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

export type WorkerMessage = {
  sql: string
  params: any[]
}

export type WorkerResult = {
  data?: any[]
  error?: any
  change?: {
    type: "INSERT" | "UPDATE" | "DELETE"
    table: string
  }
}

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
    let { sql, params } = decodeValue(sharedBufferView) as WorkerMessage
    const result: WorkerResult = {}

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
        result.data = statement.all(...params)
      } else {
        result.data = [statement.run(...params)]

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
            result.change = { type, table }
          }
        }
      }
    } catch (error: any) {
      if (typeof error === "object") {
        result.error = {
          ...error,
          message: error.message,
        }
      } else {
        result.error = error
      }
    } finally {
      encodeValue(sharedBufferView, result)
      parentPort?.postMessage(undefined)
    }
  })
}

export default class DatabaseWorker extends Worker {
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
        if (!this._task) {
          throw new Error("UNEXPECTED")
        }

        const result = decodeValue(this._sharedBufferView) as WorkerResult

        const { resolve, reject } = this._task
        this._task = undefined

        if (result.error) {
          if (typeof result.error === "object") {
            reject(Object.assign(new Error(), result.error))
          } else {
            reject(result.error)
          }
        }

        if (result.change) {
          this.emit("change", result.change)
        }

        resolve(result.data!)
      })
  }

  all(message: WorkerMessage) {
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
