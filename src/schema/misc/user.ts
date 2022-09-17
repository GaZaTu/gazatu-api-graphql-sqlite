import argon2 from "argon2"
import config from "config"
import { GraphQLFieldResolver } from "graphql"
import { array, Infer, nullable, object, optional, string } from "superstruct"
import gqlResolver, { gqlArray, gqlString, gqlType, gqlVoid } from "../../lib/gqlResolver.js"
import { signJwt } from "../../lib/jwt.js"
import { sql } from "../../lib/querybuilder.js"
import superstructToGraphQL from "../../lib/superstructToGraphQL.js"
import superstructToSQL from "../../lib/superstructToSQL.js"
import getN2MDataLoaderFromContext from "../getN2MDataLoaderFromContext.js"
import type { SchemaContext, SchemaFields } from "../schema.js"

export const UserRoleSchema = object({
  id: optional(nullable(string())),
  name: string(),
  description: optional(nullable(string())),
})

export const [
  UserRoleGraphQL,
  UserRoleGraphQLInput,
] = superstructToGraphQL<SchemaContext>()(UserRoleSchema, {
  name: "UserRole",
  fields: {},
})

export const [
  UserRoleSQL,
] = superstructToSQL(UserRoleSchema, {
  name: "UserRole",
})

export type UserRole = Infer<typeof UserRoleSchema>

const userUserRolesDataLoader = Symbol()

export const UserSchema = object({
  id: optional(nullable(string())),
  username: string(),
  password: optional(nullable(string())),
  roles: array(UserRoleSchema),
  createdAt: optional(nullable(string())),
  updatedAt: optional(nullable(string())),
})

const resolveUserRolesForUser: GraphQLFieldResolver<User, SchemaContext, {}, Promise<UserRole[]>> = async (self, args, ctx) => {
  const dataloader = getN2MDataLoaderFromContext(ctx, userUserRolesDataLoader, UserRoleSQL, N2MUserUserRoleSQL, "userId", "userRoleId")

  const result = await dataloader.load(self.id!)
  return result
}

export const [
  UserGraphQL,
  UserGraphQLInput,
] = superstructToGraphQL<SchemaContext>()(UserSchema, {
  name: "User",
  fields: {
    password: gqlResolver({
      type: gqlVoid(),
      resolve: () => "you wish",
      extensions: {
        complexity: Number.MAX_SAFE_INTEGER,
      },
    }),
    roles: gqlResolver({
      type: gqlArray(gqlType(UserRoleGraphQL)),
      resolve: resolveUserRolesForUser,
    }),
  },
})

export const [
  UserSQL,
] = superstructToSQL(UserSchema, {
  name: "User",
})

export type User = Infer<typeof UserSchema>

export const N2MUserUserRoleSchema = object({
  userId: string(),
  userRoleId: string(),
})

export const [
  N2MUserUserRoleSQL,
] = superstructToSQL(N2MUserUserRoleSchema, {
  name: `N2M_${UserSQL}_${UserRoleSQL}`,
})

export const AuthSchema = object({
  token: string(),
  user: UserSchema,
})

export const [
  AuthGraphQL,
] = superstructToGraphQL<SchemaContext>()(AuthSchema, {
  name: "Auth",
  fields: {},
})

type Auth = Infer<typeof AuthSchema>

interface AuthAttempt {
  count: number
  timestamp: number
}

const recentAuthAttempts = new Map<string, AuthAttempt>()

const authenticate: GraphQLFieldResolver<{}, SchemaContext, { username: string, password: string }, Promise<Auth>> = async (self, args, ctx, info) => {
  const { db, http } = ctx

  const recentAuthAttempt = recentAuthAttempts.get(http.ip)

  if (recentAuthAttempt) {
    const secs = (secs: number) => secs * 1000
    const mins = (mins: number) => secs(mins * 60)

    let waitMs = 0

    if (recentAuthAttempt.count > 12) {
      waitMs = mins(5)
    } else if (recentAuthAttempt.count > 6) {
      waitMs = mins(1)
    } else if (recentAuthAttempt.count > 3) {
      waitMs = secs(5)
    }

    if (recentAuthAttempt.timestamp > (Date.now() - waitMs)) {
      throw http.throw(new Error("Too many failed authentication attempts"), 429)
    }

    recentAuthAttempt.count += 1
    recentAuthAttempt.timestamp = Date.now()
  }

  const user = await db.of(UserSQL)
    .findOne(sql`${UserSQL.schema.username} = ${args.username}`)

  if (user) {
    if (await argon2.verify(user.password!, args.password)) {
      user.password = undefined

      if (recentAuthAttempt) {
        recentAuthAttempts.delete(http.ip)
      }

      Object.assign(user, {
        roles: await resolveUserRolesForUser(user, {}, ctx, info),
      })

      return {
        token: await signJwt({ id: user.id }),
        user,
      }
    }
  }

  if (!recentAuthAttempt) {
    recentAuthAttempts.set(http.ip, {
      count: 1,
      timestamp: Date.now(),
    })
  }

  throw http.throw(new Error("username and password do not match"), 400)
}

const getDefaultUserRoleMapping = () => {
  if (!config.has("defaultUserRoleMapping")) {
    return undefined
  }

  return config.get("defaultUserRoleMapping") as Record<string, string[]>
}

export const userResolver: SchemaFields = {
  query: {
    authenticate: gqlResolver({
      type: gqlType(AuthGraphQL),
      args: {
        username: {
          type: gqlString(),
        },
        password: {
          type: gqlString(),
        },
      },
      resolve: authenticate,
    }),
  },
  mutation: {
    registerUser: gqlResolver({
      type: gqlType(AuthGraphQL),
      args: {
        username: {
          type: gqlString(),
        },
        password: {
          type: gqlString(),
        },
      },
      resolve: async (self, args, ctx, info) => {
        const { db } = ctx

        const username = args.username
        const password = await argon2.hash(args.password)
        const [user] = await db.of(UserSQL)
          .save({ username, password })

        const defaultUserRoleMapping = getDefaultUserRoleMapping()
        if (defaultUserRoleMapping) {
          const defaultUserRoles = defaultUserRoleMapping[username]
          for (const defaultUserRole of defaultUserRoles ?? []) {
            let role = await db.of(UserRoleSQL)
              .findOne(sql`${UserRoleSQL.schema.name} = ${defaultUserRole}`)
            if (!role) {
              [role] = await db.of(UserRoleSQL)
                .save({ name: defaultUserRole })
            }

            await db.of(N2MUserUserRoleSQL)
              .save({
                userId: user.id!,
                userRoleId: role.id!,
              })
          }
        }

        const result = await authenticate(self, args, ctx, info)
        return result
      },
    }),
  },
}
