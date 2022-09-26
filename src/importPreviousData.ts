import { mkdir, rm, writeFile } from "fs/promises"
import fetch from "node-fetch"
import ProxyAgent from "proxy-agent"
import { projectDir } from "./lib/moduleDir.js"
import { sql } from "./lib/querybuilder.js"
import { BlogEntrySQL } from "./schema/blog/blogEntry.js"
import { TriviaCategorySQL } from "./schema/trivia/category.js"
import { N2MTriviaQuestionTriviaCategorySQL, TriviaQuestionSQL } from "./schema/trivia/question.js"
import useDatabaseApi, { databaseConnections } from "./schema/useDatabaseApi.js"

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
  "Michael Jackson": "General Knowledge",
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

void (async () => {
  const response = await fetch("https://api.gazatu.xyz/trivia/questions?shuffled=false", {
    agent: httpProxyAgent,
  })
  const responseJson = await response.json() as TriviaQuestion[]

  try {
    await useDatabaseApi(async dbApi => {
      await dbApi.transaction(async () => {
        await dbApi.remove()
          .from(TriviaQuestionSQL)
        await dbApi.remove()
          .from(TriviaCategorySQL)

        for (const question of responseJson) {
          question.category = categoryAliases[question.category] ?? question.category

          let categoryId = undefined as string | undefined
          try {
            const [{ id }] = await dbApi.of(TriviaCategorySQL)
              .save({
                name: question.category,
                verified: true,
                disabled: false,
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
    })
  } finally {
    databaseConnections.clear()
  }

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

  try {
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

    await useDatabaseApi(async dbApi => {
      await dbApi.transaction(async () => {
        await dbApi.remove()
          .from(BlogEntrySQL)

        for (const blogEntry of responseBlogJson.data.blogEntries) {
          if (!blogEntry.imageFileExtension) {
            continue
          }

          try {
            const image = await fetch(`https://api.gazatu.xyz/blog/entries/${blogEntry.id}/image.${blogEntry.imageFileExtension}`, {
              agent: httpProxyAgent,
            }).then(r => r.arrayBuffer())
            const preview = await fetch(`https://api.gazatu.xyz/blog/entries/${blogEntry.id}/preview.${blogEntry.imageFileExtension}`, {
              agent: httpProxyAgent,
            }).then(r => r.arrayBuffer())

            const [{ id }] = await dbApi.of(BlogEntrySQL)
              .save({
                story: blogEntry.story,
                title: blogEntry.title,
                message: blogEntry.message,
                imageMimeType: blogEntry.imageMimeType,
                imageFileExtension: blogEntry.imageFileExtension,
                createdAt: blogEntry.createdAt,
              })

            await writeFile(`${imagesPath}/${id}.${blogEntry.imageFileExtension}`, Buffer.from(image))
            await writeFile(`${previewsPath}/${id}.${blogEntry.imageFileExtension}`, Buffer.from(preview))
          } catch (error) {
            console.warn(error)
          }
        }
      })
    })
  } finally {
    databaseConnections.clear()
  }

  return "done"
})().then(console.log, console.error)
