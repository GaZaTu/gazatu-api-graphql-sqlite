/* eslint-disable @typescript-eslint/no-explicit-any */

import { mkdir, readdir, readFile } from "node:fs/promises"
import sqlite3 from "sqlite3"
import moduleDir from "../lib/moduleDir.js"
import { SQLite3Repository } from "../lib/querybuilder-sqlite.js"
import { createCreateFTSSyncTriggersScript } from "../lib/sqlite-createftssynctriggers.js"
import { createCreateISOTimestampTriggersScript } from "../lib/sqlite-createisotimestamptriggers.js"

const __dirname = moduleDir(import.meta.url)

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
    "CREATE_FTS_SYNC_TRIGGERS": async (database: sqlite3.Database, [srcTable, ftsTable, ftsTableType]: string[]) => {
      const tableInfo = await all(database, `PRAGMA table_info('${ftsTable}')`)
      const fields = tableInfo.map(f => f.name)

      const script = createCreateFTSSyncTriggersScript(srcTable, ftsTable, ftsTableType, fields)
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
  await exec(database, "PRAGMA journal_mode = wal")
  await exec(database, "PRAGMA synchronous = normal")
  await exec(database, "PRAGMA foreign_keys = ON")

  const migrationsDir = `${__dirname}/../../migrations`

  let version = await getDatabaseVersion(database)
  for (const scriptPath of await readdir(migrationsDir)) {
    const scriptVersion = Number(/v(\d+).sql/.exec(scriptPath)![1])
    if (scriptVersion <= version) {
      continue
    }

    const script = await readFile(`${migrationsDir}/${scriptPath}`, { encoding: "utf-8" })

    console.log(`updating database from v${version} to v${scriptVersion}`)

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
  await exec(database, "PRAGMA analysis_limit = 400")
  await exec(database, "PRAGMA optimize")
}

const open = async (options = { trace: true }) => {
  await mkdir(`${__dirname}/../../data`, { recursive: true })

  const file = `${__dirname}/../../data/database.sqlite3`
  const mode = sqlite3.OPEN_CREATE | sqlite3.OPEN_READWRITE | sqlite3.OPEN_URI

  const database = new sqlite3.Database(file, mode)
  const close = database.close.bind(database)

  await new Promise<void>((resolve, reject) => {
    database.on("error", reject)
    database.on("open", async () => {
      await databaseAfterOpen(database)

      resolve()
    })
  })

  if (options.trace && process.env.NODE_ENV !== "production") {
    database.on("trace", sql => {
      if (sql.startsWith("PRAGMA")) {
        return
      }

      console.log(`${sql};`)
    })
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

const connection = {
  db: undefined as Awaited<ReturnType<typeof open>> | undefined,
  dbApi: undefined as SQLite3Repository | undefined,
  refs: 0,
}

const connectDatabase = async (options = { trace: true }) => {
  if (!connection.db || !connection.dbApi) {
    connection.db = await open(options)
    connection.dbApi = new SQLite3Repository((...a) => all(connection.db!, ...a))
  }

  connection.refs += 1

  const closeConnection = connection.db.close.bind(connection.db)
  const close = async () => {
    connection.refs -= 1

    if (connection.refs === 0) {
      await closeConnection()

      connection.db = undefined
      connection.dbApi = undefined
    }
  }

  Object.assign(connection.db, { close })

  return [
    connection.db!,
    connection.dbApi!,
  ] as const
}

export default connectDatabase
