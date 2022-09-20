import Router from "@koa/router"
import createKoaSSEStream from "../../lib/createKoaSSEStream.js"
import { qArray, qBoolean, qNumber, qString } from "../../lib/query-parsing.js"
import { executeGraphQLInTransaction } from "../graphqlRouter.js"
import { databaseUpdateHooks } from "../useDatabaseApi.js"
import { TriviaQuestion } from "./question.js"

export const triviaSSEOTPSet = new Set<string>()

const triviaRouter = new Router({ prefix: "/trivia" })

export default triviaRouter

triviaRouter.get("/sse", async ctx => {
  const otp = qString(ctx, q => q.otp) ?? ""
  if (!triviaSSEOTPSet.has(otp)) {
    throw ctx.throw(401, new Error("Invalid OTP"))
  }

  triviaSSEOTPSet.delete(otp)

  const stream = createKoaSSEStream(ctx)

  const listener = (type: string, database: string, table: string, rowid: number) => {
    if (!table.includes("Trivia") || table.includes("FTS")) {
      return
    }

    stream.writeData({ type, table })
  }

  databaseUpdateHooks.add(listener)
  stream.on("close", () => {
    databaseUpdateHooks.delete(listener)
  })
})

type Query = {
  triviaQuestionsConnection?: {
    slice: TriviaQuestion[]
  }
}

triviaRouter.get("/questions", async ctx => {
  const exclude = qArray(ctx, q => q.exclude ?? q.exc)
  const include = qArray(ctx, q => q.include ?? q.inc)
  const submitters = qArray(ctx, q => q.submitters)
  const verified = qBoolean(ctx, q => q.verified) ?? true
  const disabled = qBoolean(ctx, q => q.disabled) ?? false
  const shuffled = qBoolean(ctx, q => q.shuffled) ?? true
  const limit = qNumber(ctx, q => q.limit ?? q.count) ?? 10

  const result = await executeGraphQLInTransaction<Query>({
    query: `
      query ($args: TriviaQuestionsConnectionArgs) {
        triviaQuestionsConnection(args: $args) {
          slice {
            id
            categories {
              id
              name
            }
            question
            answer
            hint1
            hint2
            submitter
          }
        }
      }
    `,
    variables: {
      args: {
        limit: shuffled ? null : limit,
        verified,
        disabled,
      },
    },
    context: {
      http: ctx,
    },
  }, {
    ignoreComplexity: true,
  })

  let questions = (result.data?.triviaQuestionsConnection?.slice ?? [])
    .filter(({ categories }) => {
      for (const category of categories) {
        if (exclude?.includes(category.name)) {
          return false
        }
      }

      return true
    })
    .filter(({ categories }) => {
      for (const required of include ?? []) {
        if (!categories.map(c => c.name).includes(required)) {
          return false
        }
      }

      return true
    })
    .filter(({ submitter }) => {
      if (submitters) {
        return submitters.includes(submitter ?? "")
      }

      return true
    })
    .map(question => ({
      ...question,
      categories: question.categories.map(c => c.name),
      category: question.categories[0]?.name,
    }))

  if (shuffled) {
    const shuffleInPlace = <T>(a: T[]): T[] => {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))

        void ([a[i], a[j]] = [a[j], a[i]])
      }

      return a
    }

    shuffleInPlace(questions)

    if (limit) {
      questions = questions.slice(0, limit)
    }
  }

  ctx.response.type = "application/json"
  ctx.response.body = questions
})
