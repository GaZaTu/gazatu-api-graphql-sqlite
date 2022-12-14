import Router from "@koa/router"
import createKoaSSEStream from "../../lib/createKoaSSEStream.js"
import { qArray, qBoolean, qNumber, qString } from "../../lib/query-parsing.js"
import { databaseHooks } from "../database.js"
import { executeGraphQLWithDatabase } from "../graphqlRouter.js"
import { triviaEventsOTPSet, TriviaQuestion } from "./question.js"

const triviaRouter = new Router({ prefix: "/trivia" })

export default triviaRouter

triviaRouter.get("/events", async ctx => {
  const otp = qString(ctx, q => q.otp) ?? ""
  if (!triviaEventsOTPSet.has(otp)) {
    throw ctx.throw(401, new Error("Invalid OTP"))
  }

  triviaEventsOTPSet.delete(otp)

  const stream = createKoaSSEStream(ctx)

  const listener = (ev: { type: string, table: string }) => {
    if (!ev.table.includes("Trivia") || ev.table.includes("FTS")) {
      return
    }

    try {
      stream.sendEvent("", ev)
    } catch {
      stream.destroy()
    }
  }

  databaseHooks.on("change", listener)
  stream.on("close", () => {
    databaseHooks.off("change", listener)
  })
})

triviaRouter.get("/questions", async ctx => {
  const limit = qNumber(ctx, q => q.limit ?? q.count) ?? 10
  const verified = qBoolean(ctx, q => q.verified) ?? true
  const disabled = qBoolean(ctx, q => q.disabled) ?? false
  const shuffled = qBoolean(ctx, q => q.shuffled) ?? true
  const include = qArray(ctx, q => q.include ?? q.inc)
  const exclude = qArray(ctx, q => q.exclude ?? q.exc)
  const submitters = qArray(ctx, q => q.submitters)

  type Query = {
    triviaQuestionListConnection?: {
      slice: TriviaQuestion[]
    }
  }

  const result = await executeGraphQLWithDatabase<Query>({
    query: `
      query ($args: TriviaQuestionListConnectionArgs) {
        triviaQuestionListConnection(args: $args) {
          slice {
            id
            categories {
              name
            }
            question
            answer
            hint1
            hint2
            submitter
            createdAt
          }
        }
      }
    `,
    variables: {
      args: {
        limit,
        verified,
        disabled,
        shuffled,
        includeCategories: include,
        excludeCategories: exclude,
        includeSubmitters: submitters,
      },
    },
    context: {
      http: ctx,
    },
  }, {
    throwErrors: true,
    ignoreComplexity: true,
  })

  const questions = (result.data?.triviaQuestionListConnection?.slice ?? [])
    .map(question => ({
      ...question,
      categories: question.categories?.map(c => c.name),
      category: question.categories?.[0]?.name,
    }))

  ctx.response.type = "application/json"
  ctx.response.body = questions
})
