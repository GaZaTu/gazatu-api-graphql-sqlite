import { verifyJwt } from "../lib/jwt.js"
import { resolveUserRolesForUser, User, UserSQL } from "./misc/user.js"
import { SchemaContext } from "./schema.js"
import useDatabaseApi from "./useDatabaseApi.js"

const currentUserSymbol = Symbol()

export const currentUser = async ({ http, db, cache }: Pick<SchemaContext, "http" | "db" | "cache">) => {
  const existing = cache[currentUserSymbol] as User
  if (existing) {
    return existing
  }

  const authHeader = http.get("authorization")
  if (!authHeader) {
    return undefined
  }

  const auth = await (async () => {
    const authToken = authHeader.replace("Bearer", "").trim()

    try {
      return await verifyJwt<{ userId: string }>(authToken)
    } catch {
      return undefined
    }
  })()
  if (!auth) {
    return undefined
  }

  const user = await db.of(UserSQL)
    .findOneById(auth.userId)
  if (!user) {
    return undefined
  }

  Object.assign(user, {
    roles: await resolveUserRolesForUser(user, { db, cache }),
  })

  cache[currentUserSymbol] = user
  return user
}

export const hasAuth = async ({ http, db, cache }: Pick<SchemaContext, "http" | "db" | "cache">, needed?: string[], user?: User) => {
  if (!user) {
    user = await currentUser({ http, db, cache })
    if (!user) {
      return false
    }
  }

  const userRoles = user.roles.map(r => r.name)
  for (const role of needed ?? []) {
    if (!userRoles.includes(role)) {
      return false
    }
  }

  return true
}

const assertAuth = async ({ http, db, cache }: Pick<SchemaContext, "http" | "db" | "cache">, needed?: string[]) => {
  if (!await hasAuth({ http, db, cache }, needed)) {
    if (needed) {
      throw http.throw(403, new Error(`Required user roles: ${needed?.join(", ")}`))
    } else {
      throw http.throw(401, new Error("You need to be logged in to access this resource"))
    }
  }
}

export default assertAuth

export const currentUserHttp = async (http: SchemaContext["http"]) => {
  return await useDatabaseApi(async db => {
    return await currentUser({ http, db, cache: http })
  })
}

export const hasAuthHttp = async (http: SchemaContext["http"], needed?: string[]) => {
  return await useDatabaseApi(async db => {
    return await hasAuth({ http, db, cache: http }, needed)
  })
}

export const assertAuthHttp = async (http: SchemaContext["http"], needed?: string[]) => {
  await useDatabaseApi(async db => {
    await assertAuth({ http, db, cache: http }, needed)
  })
}
