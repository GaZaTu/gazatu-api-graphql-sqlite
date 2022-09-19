import fetch from "node-fetch"
import { sql } from "./lib/querybuilder.js"
import connectDatabase from "./schema/connectDatabase.js"
import { TriviaCategorySQL } from "./schema/trivia/category.js"
import { N2MTriviaQuestionTriviaCategorySQL, TriviaQuestionSQL } from "./schema/trivia/question.js"
import ProxyAgent from "proxy-agent"

const HTTP_PROXY = process.env.HTTP_PROXY
const httpProxyAgent = HTTP_PROXY ? new ProxyAgent(HTTP_PROXY) : undefined

const categoryAliases: Record<string, string | undefined> = {
  "Black music": "Music",
  "Brazil": "History",
  "RandomQuestions": "Generic",
  "Canada": "Generic",
  "D DansGame TA": "Dota",
  "DansGame": "Generic",
  "Dicks": "Generic",
  "Entertainment": "Generic",
  "Girls": "Biology",
  "Google": "Generic",
  "HS": "HearthStone",
  "Homosexuals": "Generic",
  "Location": "Memes",
  "L OMEGALUL L": "LeagueOfLegends",
  "Michael Jackson": "Generic",
  "Netflix": "Generic",
  "Period": "Sex",
  "Pewdiepie": "YouTube",
  "QOTD": "Forsen",
  "Smart": "History",
  "Spongebob": "TV",
  "Travicity": "Forsen",
  "Words": "Generic",
  "memes": "Memes",
  "nymn": "Twitch",
}

type TriviaQuestion = {
  question: string
  answer: string
  category: string
  hint1: string | null
  hint2: string | null
  submitter: string
}

void (async () => {
  const response = await fetch("https://api.gazatu.xyz/trivia/questions?shuffled=false", {
    agent: httpProxyAgent,
  })
  const questions = await response.json() as TriviaQuestion[]

  const [db, dbApi] = await connectDatabase({ trace: false })

  try {
    return await dbApi.transaction(async () => {
      await dbApi.remove()
        .from(TriviaQuestionSQL)
      await dbApi.remove()
        .from(TriviaCategorySQL)

      for (const question of questions) {
        question.category = categoryAliases[question.category] ?? question.category

        let categoryId = undefined as string | undefined
        try {
          const [{ id }] = await dbApi.of(TriviaCategorySQL)
            .save({
              name: question.category,
            })
          categoryId = id!
        } catch {
          const [{ id }] = await dbApi.of(TriviaCategorySQL)
            .findMany(sql`${TriviaCategorySQL.schema.name} = ${question.category}`)
          categoryId = id!
        }

        const [{ id }] = await dbApi.of(TriviaQuestionSQL)
          .save({
            question: question.question,
            answer: question.answer,
            hint1: question.hint1 || null,
            hint2: question.hint2 || null,
            submitter: question.submitter || null,
            verified: true,
            disabled: false,
          })

        await dbApi.of(N2MTriviaQuestionTriviaCategorySQL)
          .save({
            questionId: id!,
            categoryId: categoryId!,
          })
      }
    })
  } finally {
    await db.close()
  }
})().then(console.log, console.error)
