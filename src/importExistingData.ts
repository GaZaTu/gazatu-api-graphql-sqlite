/* eslint-disable no-constant-condition */

import fetch from "node-fetch"
import { sql } from "./lib/querybuilder.js"
import database from "./schema/database.js"
import { TriviaCategorySQL } from "./schema/trivia/category.js"
import { N2MTriviaQuestionTriviaCategorySQL, TriviaQuestionSQL } from "./schema/trivia/question.js"

type TriviaQuestion = {
  question: string
  answer: string
  category: string
  hint1: string | null
  hint2: string | null
  submitter: string
}

if (true) {
  const response = await fetch("https://api.gazatu.xyz/trivia/questions?count=0&shuffled=false")
  const responseJson = await response.json() as TriviaQuestion[]

  await database.remove()
    .from(TriviaQuestionSQL)
  await database.remove()
    .from(TriviaCategorySQL)

  for (const question of responseJson) {
    let categoryId = undefined as string | undefined
    try {
      const [{ id }] = await database.of(TriviaCategorySQL)
        .save({
          name: question.category,
          verified: true,
          disabled: false,
        })
      categoryId = id!
    } catch {
      const [{ id }] = await database.of(TriviaCategorySQL)
        .findMany(sql`${TriviaCategorySQL.schema.name} = ${question.category}`)
      categoryId = id!
    }

    const [{ id }] = await database.of(TriviaQuestionSQL)
      .save({
        question: question.question,
        answer: question.answer,
        hint1: question.hint1 || null,
        hint2: question.hint2 || null,
        submitter: question.submitter || null,
        verified: true,
        disabled: false,
      })

    await database.of(N2MTriviaQuestionTriviaCategorySQL)
      .save({
        questionId: id!,
        categoryId: categoryId!,
      })
  }
}

await database.exec("PRAGMA wal_checkpoint(PASSIVE)", [])
await database.exec("PRAGMA optimize", [])

process.exit(0)
