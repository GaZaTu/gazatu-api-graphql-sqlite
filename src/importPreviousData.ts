/* eslint-disable no-constant-condition */

import fetch from "node-fetch"
import { mkdir, rm } from "node:fs/promises"
import ProxyAgent from "proxy-agent"
import { projectDir } from "./lib/moduleDir.js"
import { sql } from "./lib/querybuilder.js"
import { BlogEntrySQL } from "./schema/blog/blogEntry.js"
import { writeBlogEntryImage } from "./schema/blog/blogRouter.js"
import database from "./schema/database.js"
import { TriviaCategorySQL } from "./schema/trivia/category.js"
import { N2MTriviaQuestionTriviaCategorySQL, TriviaQuestionSQL } from "./schema/trivia/question.js"

const HTTP_PROXY = process.env.HTTP_PROXY
const httpProxyAgent = HTTP_PROXY ? new ProxyAgent(HTTP_PROXY) : undefined

const categoryAliases: Record<string, string | undefined> = {
  "Black music": "Music",
  "Brazil": "History",
  "RandomQuestions": "General Knowledge",
  "Canada": "General Knowledge",
  "D DansGame TA": "Dota",
  "DansGame": "General Knowledge",
  "Dicks": "General Knowledge",
  "Entertainment": "General Knowledge",
  "Girls": "Biology",
  "Google": "General Knowledge",
  "HS": "HearthStone",
  "Homosexuals": "General Knowledge",
  "Location": "Memes",
  "L OMEGALUL L": "LeagueOfLegends",
  "Michael Jackson": "Music",
  "Netflix": "General Knowledge",
  "Period": "Sex",
  "Pewdiepie": "YouTube",
  "QOTD": "Forsen",
  "Smart": "History",
  "Spongebob": "TV",
  "Travicity": "Forsen",
  "Words": "General Knowledge",
  "memes": "Memes",
  "nymn": "Twitch",
  "Cartoons": "TV",
  "gazatu2 trivia FeelsDankMan": "General Knowledge",
  "Maths": "Math",
  "Marcedone": "Twitch",
  "Country": "General Knowledge",
  "Programming": "Computer Science",
  "Cunts": "__IGNORE__",
  "Literature": "General Knowledge",
  "test": "__IGNORE__",
  "Who": "__IGNORE__",
  "Chat Commands": "Twitch",
  "Streamers": "Twitch",
  "World ": "World",
  "Space": "Science",
  "W_OMEGALUL_W": "WorldOfWarcraft",
  "Brand New": "Music",
  "Buick": "Cars",
  "Pepega": "Twitch",
}

type TriviaQuestion = {
  question: string
  answer: string
  category: string
  hint1: string | null
  hint2: string | null
  submitter: string
}

type BlogResult = {
  data: {
    blogEntries: {
      id: string
      story: string
      title: string
      message: string
      imageMimeType: string
      imageFileExtension: string
      createdAt: string
    }[]
  }
}

if (true) {
  const response = await fetch("https://api.gazatu.xyz/trivia/questions?shuffled=false", {
    agent: httpProxyAgent,
  })
  const responseJson = await response.json() as TriviaQuestion[]

  await database.transaction(async () => {
    await database.remove()
      .from(TriviaQuestionSQL)
    await database.remove()
      .from(TriviaCategorySQL)

    for (const question of responseJson) {
      question.category = categoryAliases[question.category] ?? question.category

      if (question.category === "__IGNORE__") {
        continue
      }

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
  })
}

if (true) {
  const responseBlog = await fetch("https://api.gazatu.xyz/graphql", {
    agent: httpProxyAgent,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
      query {
        blogEntries {
          id
          story
          title
          message
          imageMimeType
          imageFileExtension
          createdAt
        }
      }
    `,
    }),
  })
  const responseBlogJson = await responseBlog.json() as BlogResult

  const imagesPath = `${projectDir}/data/files/blog/images`
  const previewsPath = `${projectDir}/data/files/blog/previews`

  try {
    await rm(imagesPath, { recursive: true, force: true })
    await rm(previewsPath, { recursive: true, force: true })
  } catch {
    // ignore
  }

  await mkdir(imagesPath, { recursive: true })
  await mkdir(previewsPath, { recursive: true })

  await database.transaction(async () => {
    await database.remove()
      .from(BlogEntrySQL)

    for (const blogEntry of responseBlogJson.data.blogEntries) {
      if (!blogEntry.imageFileExtension) {
        continue
      }

      try {
        const image = await fetch(`https://api.gazatu.xyz/blog/entries/${blogEntry.id}/image.${blogEntry.imageFileExtension}`, {
          agent: httpProxyAgent,
        }).then(r => r.arrayBuffer())

        const [blogEntryResult] = await database.of(BlogEntrySQL)
          .save({
            story: blogEntry.story,
            title: blogEntry.title,
            message: blogEntry.message,
            imageFileExtension: "webp",
            createdAt: blogEntry.createdAt,
          })

        await writeBlogEntryImage(blogEntryResult, Buffer.from(image))
      } catch (error) {
        console.warn(error)
      }
    }
  })
}

await database.exec("PRAGMA wal_checkpoint(PASSIVE)", [])
await database.exec("PRAGMA optimize", [])

process.exit(0)
