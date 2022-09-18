import { DefaultContext, DefaultState, ParameterizedContext } from "koa"
import { PassThrough } from "stream"

const createKoaSSEStream = (ctx: ParameterizedContext<DefaultState, DefaultContext>) => {
  ctx.request.socket.setTimeout(0)
  ctx.req.socket.setNoDelay(true)
  ctx.req.socket.setKeepAlive(true)

  ctx.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  })

  const stream = new PassThrough()

  ctx.status = 200
  ctx.body = stream

  return stream
}

export default createKoaSSEStream
