import cors from "@koa/cors"
import config from "config"
import { readFileSync } from "fs"
import http from "http"
import https from "https"
import Koa from "koa"
import body from "koa-body"
import json from "koa-json"
import logger from "koa-logger"
import { blogRouter } from "./schema/blog/blogRouter.js"
import graphqlRouter from "./schema/graphqlRouter.js"
import triviaRouter from "./schema/trivia/triviaRouter.js"

export const getHost = () => {
  if (process.env.NODE_ENV === "test") {
    return "127.0.0.1"
  }

  if (!config.has("host")) {
    return "127.0.0.1"
  }

  return config.get("host") as string
}

export const getPort = () => {
  if (process.env.NODE_ENV === "test") {
    return 4343
  }

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

export const createKoa = (middlewares: Koa.Middleware<any, any>[]) => {
  const koa = new Koa({
    proxy: true,
  })

  koa.use(cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
  }))

  koa.use(async (ctx, next) => {
    try {
      await next()

      if (!ctx.status || (ctx.status === 404 && !ctx.body)) {
        ctx.throw(404)
      }
    } catch (err: any) {
      ctx.status = err.status ?? 500
      ctx.type = "application/json"
      ctx.body = JSON.stringify({
        name: err.name,
        message: err.message,
        status: err.status,
        stack: (process.env.NODE_ENV !== "production") ? err.stack : undefined,
      }, undefined, (process.env.NODE_ENV !== "production") ? "  " : undefined)
    }
  })

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
        console.log(`listening on http://${host}:${port}`)

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
    blogRouter.middleware(),
    triviaRouter.middleware(),
    graphqlRouter.middleware(),
  ]

  const [, callback] = createKoa(middlewares)
  const [, listen] = createHttpServer(callback)

  const close = await listen()
  return close
}
