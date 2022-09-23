import { DefaultContext, DefaultState, ParameterizedContext } from "koa"
import { PassThrough } from "stream"

const createKoaSSEStream = (ctx: ParameterizedContext<DefaultState, DefaultContext>) => {
  ctx.request.socket.setTimeout(0)
  ctx.req.socket.setNoDelay(true)
  ctx.req.socket.setKeepAlive(true)

  ctx.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
  })

  const stream = new PassThrough()
  stream.write("\n\n")

  const intervalId = setInterval(() => {
    stream.write("\n\n")
  }, 45000)

  stream.on("close", () => {
    clearInterval(intervalId)
  })

  ctx.status = 200
  ctx.body = stream

  return Object.assign(stream, {
    writeData: (object: unknown) => {
      stream.write(`data: ${JSON.stringify(object)}\n\n`)
    },
  })
}

export default createKoaSSEStream
