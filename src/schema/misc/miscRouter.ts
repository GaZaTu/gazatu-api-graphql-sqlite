import Router from "@koa/router"
import AdmZip from "adm-zip"
import { projectDir } from "../../lib/moduleDir.js"
import { assertAuthHttp } from "../assertAuth.js"

const miscRouter = new Router()

export default miscRouter

miscRouter.get("/backup.zip", async ctx => {
  await assertAuthHttp(ctx, ["admin"])

  const zip = new AdmZip()
  await zip.addLocalFolderPromise(`${projectDir}/config`, { zipPath: "/config" })
  await zip.addLocalFolderPromise(`${projectDir}/data`, { zipPath: "/data" })

  ctx.type = "zip"
  ctx.body = await zip.toBufferPromise()
})
