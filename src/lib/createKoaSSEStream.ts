import { ParameterizedContext } from "koa"
import { PassThrough } from "stream"

const createKoaSSEStream = <S, C>(ctx: ParameterizedContext<S, C>) => {
  ctx.request.socket.setTimeout(0)
  ctx.request.socket.setNoDelay(true)
  ctx.request.socket.setKeepAlive(true)

  ctx.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
  })

  const stream = new PassThrough()
  stream.write(":ping\n\n")

  const intervalId = setInterval(() => {
    stream.write(":ping\n\n")
  }, 30000)

  stream.on("close", () => {
    clearInterval(intervalId)
  })

  ctx.status = 200
  ctx.body = stream

  return Object.assign(stream, {
    sendEvent: (event: string | undefined, object: unknown) => {
      return new Promise<void>((resolve, reject) => {
        stream.write(`${event ? `event: ${event}\n` : ""}data: ${JSON.stringify(object)}\n\n`, err => {
          err ? reject(err) : resolve()
        })
      })
    },
  })
}

export default createKoaSSEStream
