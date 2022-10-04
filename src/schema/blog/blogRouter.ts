import Router from "@koa/router"
import { createReadStream, existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import sharp from "sharp"
import { projectDir } from "../../lib/moduleDir.js"
import { assertAuthHttp } from "../assertAuth.js"
import database from "../database.js"
import { BlogEntry, BlogEntrySQL } from "./blogEntry.js"

const blogRouter = new Router({ prefix: "/blog" })

export default blogRouter

blogRouter.get("/entries/:id/image.:ext", async ctx => {
  const blogEntry = await database.of(BlogEntrySQL)
    .findOneById(ctx.params.id)
  if (!blogEntry?.imageFileExtension) {
    throw ctx.throw(404)
  }

  if (ctx.params.ext !== blogEntry.imageFileExtension) {
    throw ctx.throw(404)
  }

  ctx.type = blogEntry.imageFileExtension
  ctx.body = createReadStream(await getImagePath(blogEntry, "images"))
})

blogRouter.get("/entries/:id/preview.webp", async ctx => {
  const blogEntry = await database.of(BlogEntrySQL)
    .findOneById(ctx.params.id)
  if (!blogEntry?.imageFileExtension) {
    throw ctx.throw(404)
  }

  ctx.type = "webp"
  ctx.body = createReadStream(await getImagePath(blogEntry, "previews"))
})

blogRouter.post("/entries/:id/image.:ext", async ctx => {
  await assertAuthHttp(ctx, ["admin"])

  const blogEntry = await database.of(BlogEntrySQL)
    .findOneById(ctx.params.id)
  if (!blogEntry) {
    throw ctx.throw(404)
  }

  blogEntry.imageFileExtension = ctx.params.ext

  const imageChunks = []
  for await (const chunk of ctx.req) {
    imageChunks.push(chunk)
  }

  await writeBlogEntryImage(blogEntry, Buffer.concat(imageChunks))

  ctx.status = 204
})

const getImagesDir = async (kind: "images" | "previews") => {
  const imagesDir = `${projectDir}/data/files/blog/${kind}`
  if (!existsSync(imagesDir)) {
    await mkdir(imagesDir, { recursive: true })
  }

  return imagesDir
}

const getImagePath = async ({ id, imageFileExtension }: BlogEntry, kind: "images" | "previews") => {
  if (kind === "previews") {
    imageFileExtension = "webp"
  }

  const result = `${await getImagesDir(kind)}/${id}.${imageFileExtension}`
  return result
}

export const writeBlogEntryImage = async (blogEntry: BlogEntry, imageSource: Buffer) => {
  const imagePath = await getImagePath(blogEntry, "images")
  const previewPath = await getImagePath(blogEntry, "previews")

  if (blogEntry.imageFileExtension === "webp") {
    await sharp(imageSource)
      .rotate()
      .webp({ effort: 6, quality: 80 })
      .toFile(imagePath)
  } else {
    await sharp(imageSource)
      .rotate()
      .toFile(imagePath)
  }

  await sharp(imagePath)
    .resize(256)
    .webp({ effort: 6, quality: 50 })
    .toFile(previewPath)

  const imageMetadata = await sharp(imagePath)
    .metadata()

  blogEntry.imageWidth = imageMetadata.width
  blogEntry.imageHeight = imageMetadata.height

  await database.of(BlogEntrySQL)
    .save(blogEntry)
}
