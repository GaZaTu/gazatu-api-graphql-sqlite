import Router from "@koa/router"
import createKoaSSEStream from "../../lib/createKoaSSEStream.js"
import connectDatabase from "../connectDatabase.js"

export const triviaSSEOTPSet = new Set<string>()

export const triviaSSERouter = new Router()

triviaSSERouter.get("/trivia/sse", async ctx => {
  const otp = String(ctx.query.otp)
  if (!triviaSSEOTPSet.has(otp)) {
    throw ctx.throw(401, new Error("Invalid OTP"))
  }

  triviaSSEOTPSet.delete(otp)

  const [db] = await connectDatabase({ trace: false })

  try {
    const stream = createKoaSSEStream(ctx)

    const listener = async (type: string, database: string, table: string, rowid: string) => {
      if (!["TriviaQuestion", "TriviaCategory"].includes(table)) {
        return
      }

      stream.write(`data: ${JSON.stringify({ type, table })}\n\n`)
    }

    stream.write("\n\n")

    db.on("change", listener)

    const close = () => {
      db.removeListener("change", listener)
      db.close()
    }

    stream.on("close", close)
  } catch (error) {
    db.close()
    throw error
  }
})
