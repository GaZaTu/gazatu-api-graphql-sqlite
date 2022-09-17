import cors from "@koa/cors"
import config from "config"
import { readFileSync } from "fs"
import http from "http"
import https from "https"
import Koa from "koa"
import body from "koa-body"
import logger from "koa-logger"
import json from "koa-json"
import jsonError from "koa-json-error"
import { graphqlRouter } from "./schema/handleGraphQLRequest.js"

const getHost = () => {
  if (!config.has("host")) {
    return "127.0.0.1"
  }

  return config.get("host") as string
}

const getPort = () => {
  if (!config.has("port")) {
    return 3434
  }

  return config.get("port") as number
}

type HttpsConfigSource = {
  key: string
  cert: string
  ca: string[]
}

const getHttpsConfig = () => {
  if (!config.has("httpsConfig")) {
    return undefined
  }

  const httpsConfigSource = config.get("httpsConfig") as HttpsConfigSource
  const httpsConfig = {
    key: readFileSync(httpsConfigSource.key),
    cert: readFileSync(httpsConfigSource.cert),
    ca: httpsConfigSource.ca.map(p => readFileSync(p)),
  }

  return httpsConfig
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createKoa = (middlewares: Koa.Middleware<any, any>[]) => {
  const koa = new Koa()

  koa.use(cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
  }))

  koa.use(jsonError({
    format: err => JSON.stringify({
      name: err.name,
      message: err.message,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: (err as any).type,
      status: err.status,
      stack: (process.env.NODE_ENV !== "production") ? err.stack : undefined,
    }, undefined, "  "),
  }))

  koa.use(body())

  koa.use(json({
    pretty: (process.env.NODE_ENV !== "production"),
  }))

  if (process.env.NODE_ENV !== "production") {
    koa.use(logger())
  }

  koa.use(async (ctx, next) => {
    ctx.res.setHeader("Keep-Alive", "timeout=60")
    await next()
  })

  for (const middleware of middlewares) {
    koa.use(middleware)
  }

  const callback = koa.callback()

  return [koa, callback] as const
}

export const createHttpServer = (callback: (req: http.IncomingMessage, res: http.ServerResponse) => void) => {
  const server = (() => {
    const httpsConfig = getHttpsConfig()
    if (httpsConfig) {
      return https.createServer(httpsConfig, callback)
    } else {
      return http.createServer(callback)
    }
  })()

  const listen = () =>
    new Promise<() => Promise<void>>(resolve => {
      const host = getHost()
      const port = getPort()

      server.listen(port, host, () => {
        console.log(`listening on ${host}:${port}`)

        const close = () => {
          console.log(`close ${host}:${port}`)

          return new Promise<void>((resolve, reject) => {
            server.close(err => err ? reject(err) : resolve())
          })
        }

        resolve(close)
      })
    })

  return [server, listen] as const
}

export const listen = async () => {
  const middlewares = [
    graphqlRouter.middleware(),
  ]

  const [, callback] = createKoa(middlewares)
  const [, listen] = createHttpServer(callback)

  const close = await listen()
  return close
}
