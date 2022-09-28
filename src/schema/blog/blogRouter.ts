import Router from "@koa/router"
import { createReadStream, createWriteStream, existsSync } from "fs"
import { mkdir } from "fs/promises"
import sharp from "sharp"
import { projectDir } from "../../lib/moduleDir.js"
import { assertAuthHttp } from "../assertAuth.js"
import database from "../database.js"
import { BlogEntry, BlogEntrySQL } from "./blogEntry.js"

export const router = new Router({ prefix: "/blog" })

router.get("/entries/:id/image.:ext", async ctx => {
  const blogEntry = await database.of(BlogEntrySQL).findOneById(ctx.params.id)
  if (!blogEntry) {
    ctx.status = 404
    return
  }

  ctx.type = blogEntry.imageMimeType!
  ctx.body = createReadStream(await getImagePath(blogEntry, "images"))
})

router.get("/entries/:id/preview.:ext", async ctx => {
  const blogEntry = await database.of(BlogEntrySQL).findOneById(ctx.params.id)
  if (!blogEntry?.imageMimeType) {
    ctx.status = 404
    return
  }

  ctx.type = blogEntry.imageMimeType!
  ctx.body = createReadStream(await getImagePath(blogEntry, "previews"))
})

router.post("/entries/:id/image.:ext", async ctx => {
  await assertAuthHttp(ctx, ["admin"])

  const blogEntry = await database.of(BlogEntrySQL).findOneById(ctx.params.id)
  if (!blogEntry) {
    ctx.status = 400
    return
  }

  blogEntry.imageMimeType = ctx.headers["content-type"]
  blogEntry.imageFileExtension = ctx.params.ext

  const imagePath = await getImagePath(blogEntry, "images")
  const previewPath = await getImagePath(blogEntry, "previews")

  const imageStream = createWriteStream(imagePath)
  for await (const chunk of ctx.req) {
    await new Promise(resolve => imageStream.write(chunk, resolve))
  }
  await new Promise(resolve => imageStream.close(resolve))

  await new Promise(resolve => {
    createReadStream(imagePath)
      .pipe(sharp().resize({ width: 128, height: 128 }).withMetadata())
      .pipe(createWriteStream(previewPath))
      .on("close", resolve)
  })

  database.of(BlogEntrySQL).save(blogEntry)

  ctx.status = 204
})

const getImagesDir = async (kind: "images" | "previews") => {
  const imagesDir = `${projectDir}/data/files/blog/${kind}`
  if (!existsSync(imagesDir)) {
    await mkdir(imagesDir, { recursive: true })
  }

  return imagesDir
}

const getImagePath = async (blogEntry: BlogEntry, kind: "images" | "previews") => {
  return `${await getImagesDir(kind)}/${blogEntry.id}.${blogEntry.imageFileExtension}`
}
