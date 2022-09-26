import crypto from "node:crypto"
import EventEmitter from "node:events"
import { mkdir, readdir, readFile } from "node:fs/promises"
import sqlite3, { Database } from "sqlite3"
import { projectDir } from "../lib/moduleDir.js"
import { SQLite3Repository } from "../lib/querybuilder-sqlite.js"
import { createCreateFTSSyncTriggersN2MScript, createCreateFTSSyncTriggersScript } from "../lib/sqlite-createftssynctriggers.js"
import { createCreateISOTimestampTriggersScript } from "../lib/sqlite-createisotimestamptriggers.js"

const get = (database: sqlite3.Database, sql: string, params?: any[]) =>
  new Promise<Record<string, any>>((resolve, reject) => {
    database.get(sql, params, (err, row) => {
      if (err) {
        reject(err)
      } else {
        resolve(row)
      }
    })
  })

const all = (database: sqlite3.Database, sql: string, params?: any[]) =>
  new Promise<Record<string, any>[]>((resolve, reject) => {
    database.all(sql, params, (err, row) => {
      if (err) {
        reject(err)
      } else {
        resolve(row)
      }
    })
  })

const exec = (database: sqlite3.Database, sql: string) =>
  new Promise<void>((resolve, reject) => {
    database.exec(sql, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })

const getDatabaseVersion = async (database?: sqlite3.Database) => {
  if (!database) {
    return -1
  }

  const { user_version } = await get(database, "PRAGMA user_version")
  return user_version as number
}

const setDatabaseVersion = async (database?: sqlite3.Database, version = 0) => {
  if (!database) {
    return
  }

  await exec(database, `PRAGMA user_version = ${version}`)
}

const expandMacros = (script: string) => {
  const regex = /^!!(\w+)\(([^)]*)\);$/gm
  const macros = {
    "CREATE_FTS_SYNC_TRIGGERS": async (database: sqlite3.Database, [srcTable, ftsTable]: string[]) => {
      const tableInfo = await all(database, `PRAGMA table_info('${ftsTable}')`)
      const fields = tableInfo.map(f => f.name)

      const script = createCreateFTSSyncTriggersScript(srcTable, ftsTable, fields)
      await exec(database, script)
    },
    "CREATE_FTS_SYNC_TRIGGERS_N2M": async (database: sqlite3.Database, [srcTable, ftsTable, n2mTable, srcId, n2mId]: string[]) => {
      const tableInfo = await all(database, `PRAGMA table_info('${ftsTable}')`)
      const fields = tableInfo.map(f => f.name)

      const script = createCreateFTSSyncTriggersN2MScript(srcTable, ftsTable, n2mTable, srcId, n2mId, fields)
      await exec(database, script)
    },
    "CREATE_ISO_TIMESTAMP_TRIGGERS": async (database: sqlite3.Database, [table, column]: string[]) => {
      const script = createCreateISOTimestampTriggersScript(table, column)
      await exec(database, script)
    },
  }

  const macroCalls = [] as { macro: string, params: string[] }[]

  for (let match; (match = regex.exec(script));) {
    const prefix = script.slice(0, match.index)
    const suffix = script.slice(regex.lastIndex)

    const [, macro, paramsAsString] = match
    const params = paramsAsString.split(",")
      .map(p => p.replace(/'/g, "").replace(/"/g, "").trim())

    script = `${prefix}${suffix}`
    regex.lastIndex = match.index

    macroCalls.push({ macro, params })
  }

  const execMacros = async (database: sqlite3.Database) => {
    for (const { macro, params } of macroCalls) {
      const macroFunc = macros[macro as keyof typeof macros]
      if (!macroFunc) {
        continue
      }

      await macroFunc(database, params)
    }
  }

  return [script, execMacros] as const
}

const databaseAfterOpen = async (database: sqlite3.Database) => {
  database.configure("busyTimeout", 10000)

  await exec(database, "PRAGMA journal_mode = wal")
  await exec(database, "PRAGMA wal_autocheckpoint = 512")
  await exec(database, "PRAGMA synchronous = normal")
  await exec(database, "PRAGMA foreign_keys = ON")
  await exec(database, "PRAGMA trusted_schema = ON")

  const migrationsDir = `${projectDir}/migrations`

  let version = await getDatabaseVersion(database)
  for (const scriptPath of await readdir(migrationsDir)) {
    const scriptVersion = Number(/v(\d+).sql/.exec(scriptPath)![1])
    if (scriptVersion <= version) {
      continue
    }

    const script = await readFile(`${migrationsDir}/${scriptPath}`, { encoding: "utf-8" })

    // console.log(`updating database from v${version} to v${scriptVersion}`)

    await exec(database, "BEGIN TRANSACTION")
    try {
      const [scriptWithoutMacros, execMacros] = expandMacros(script)

      await exec(database, scriptWithoutMacros)
      await execMacros(database)

      await setDatabaseVersion(database, version = scriptVersion)

      await exec(database, "COMMIT")
    } catch (error) {
      await exec(database, "ROLLBACK")
      throw error
    }
  }
}

const databaseBeforeClose = async (database: sqlite3.Database) => {
  await exec(database, "PRAGMA analysis_limit = 1024")
  await exec(database, "PRAGMA optimize")
}

const open = async (options = { trace: true }) => {
  await mkdir(`${projectDir}/data`, { recursive: true })

  const file = `${projectDir}/data/database.sqlite3`
  const mode = sqlite3.OPEN_CREATE | sqlite3.OPEN_READWRITE | sqlite3.OPEN_URI

  const database = new sqlite3.Database((process.env.NODE_ENV === "test") ? ":memory:" : file, mode)
  const close = database.close.bind(database)

  await new Promise<void>((resolve, reject) => {
    database.on("error", reject)
    database.on("open", async () => {
      await databaseAfterOpen(database)

      resolve()
    })
  })

  if (options.trace && process.env.NODE_ENV !== "production") {
    // database.on("trace", sql => {
    //   if (sql.startsWith("--") || sql.startsWith("PRAGMA")) {
    //     return
    //   }

    //   console.log(`${sql};`)
    // })
  }

  return Object.assign(database, {
    close: async () => {
      await databaseBeforeClose(database)

      await new Promise<void>((resolve, reject) => {
        close(err => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    },
  })
}

const statementCacheAll = new Map<sqlite3.Database, Map<string, sqlite3.Statement>>()

export const createCachedAll = (db: sqlite3.Database) => {
  const statementCache = new Map<string, sqlite3.Statement>()
  statementCacheAll.set(db, statementCache)

  const getStatement = async (query: string) => {
    const cacheKey = crypto.createHash("md5").update(query).digest("hex")

    if (statementCache.has(cacheKey)) {
      return statementCache.get(cacheKey)!
    }

    const statement = await new Promise<sqlite3.Statement>((resolve, reject) => {
      const statement = db.prepare(query, err => {
        if (err) {
          reject(err)
        } else {
          resolve(statement)
        }
      })
    })

    statementCache.set(cacheKey, statement)
    return statement
  }

  const close = db.close.bind(db)
  Object.assign(db, {
    close: async () => {
      statementCacheAll.delete(db)

      await Promise.all(
        [...statementCache.values()].map(stmt => {
          return new Promise<void>((resolve, reject) => {
            stmt.finalize(err => err ? reject(err) : resolve())
          })
        })
      )

      statementCache.clear()

      await close()
    },
  })

  const all = async (query: string, values: any[]) => {
    query = query.trim()

    const statement = await getStatement(query)

    if (
      query.startsWith("INSERT") ||
      query.startsWith("UPDATE") ||
      query.startsWith("DELETE")
    ) {
      await Promise.all(
        [...statementCacheAll.values()]
          .flatMap(statementCache => [...statementCache.values()])
          .map(statement => {
            return new Promise(resolve => {
              statement.reset(resolve)
            })
          })
      )
    }

    const rows = await new Promise<Record<string, any>[]>((resolve, reject) => {
      statement.all(values, (err, rows) => {
        if (err) {
          if ((err as any).code === "SQLITE_BUSY") {
            all(query, values).then(resolve, reject)
          } else {
            reject(err)
          }
        } else {
          resolve(rows)
        }
      })
    })

    return rows
  }

  return all
}

export type DatabaseConnection = {
  db: Awaited<ReturnType<typeof open>>
  dbApi: SQLite3Repository
  inUse?: boolean
  timeoutId?: any
}

export const databaseConnections = new Set<DatabaseConnection>()

export type DatabaseUpdateHook = (type: string, database: string, table: string, rowid: number) => void
export const databaseUpdateHooks = new EventEmitter() as EventEmitter & {
  emit(event: "change", ...args: Parameters<DatabaseUpdateHook>): void
  on(event: "change", listener: DatabaseUpdateHook): void
}

const databaseConnectionsAdd = databaseConnections.add.bind(databaseConnections)
Object.assign(databaseConnections, {
  add: (value: DatabaseConnection) => {
    value.db.on("change", (...args) => {
      databaseUpdateHooks.emit("change", ...args)
    })

    return databaseConnectionsAdd(value)
  },
})

const connectionsDelete = databaseConnections.delete.bind(databaseConnections)
Object.assign(databaseConnections, {
  delete: (value: DatabaseConnection) => {
    clearTimeout(value.timeoutId)

    void (async () => {
      await exec(value.db, "PRAGMA wal_checkpoint(PASSIVE)")
      await value.db.close()
    })().then(console.log, console.error)

    return connectionsDelete(value)
  },
  clear: () => {
    for (const connection of databaseConnections) {
      connection.inUse = true
      databaseConnections.delete(connection)
    }
  },
})

const useDatabaseApi = async <T>(user: (dbApi: SQLite3Repository, db: Database) => Promise<T>) => {
  const use = async (connection: DatabaseConnection) => {
    connection.dbApi.clearCache()

    connection.inUse = true
    clearTimeout(connection.timeoutId)

    try {
      return await user(connection.dbApi, connection.db)
    } finally {
      connection.timeoutId = setTimeout(() => databaseConnections.delete(connection), 1000 * 60 * 10) // 10 minutes
      connection.inUse = false
    }
  }

  for (const connection of databaseConnections) {
    if (!connection.inUse) {
      return await use(connection)
    }
  }

  const db = await open()
  const dbApi = new SQLite3Repository(createCachedAll(db))

  const connection = { db, dbApi } as DatabaseConnection
  databaseConnections.add(connection)

  return await use(connection)
}

export default useDatabaseApi

// databaseUpdateHooks.add((type, database, table, rowid) => {
//   console.log({ type, database, table, rowid })
// })
