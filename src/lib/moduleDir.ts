import { dirname, resolve } from "node:path"

const moduleDir = (importMetaUrl: string) => {
  let __dirname = dirname(new URL(importMetaUrl).pathname)
  if (__dirname[0] === "/" && __dirname[2] === ":") {
    __dirname = __dirname.slice(1)
  }
  return __dirname
}

export default moduleDir

const __dirname = moduleDir(import.meta.url)

export const projectDir = resolve(`${__dirname}/../..`)
