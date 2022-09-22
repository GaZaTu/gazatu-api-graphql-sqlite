import { ParsedUrlQuery } from "querystring"

export const qString = (ctx: { query: ParsedUrlQuery }, func: (q: ParsedUrlQuery) => unknown) => {
  const r = func(ctx.query)
  if (r === undefined) {
    return undefined
  }

  return String(r)
}

export const qNumber = (ctx: { query: ParsedUrlQuery }, func: (q: ParsedUrlQuery) => unknown) => {
  const r = func(ctx.query)
  if (r === undefined) {
    return undefined
  }

  return Number(r)
}

export const qBoolean = (ctx: { query: ParsedUrlQuery }, func: (q: ParsedUrlQuery) => unknown) => {
  const r = func(ctx.query)
  if (r === undefined) {
    return undefined
  }

  return String(r) === "true"
}

export const qArray = (ctx: { query: ParsedUrlQuery }, func: (q: ParsedUrlQuery) => unknown) => {
  const r = func(ctx.query)
  if (r === undefined) {
    return undefined
  }

  return String(r)
    .replace("[", "")
    .replace("]", "")
    .split(",")
}

export const qJson = (ctx: { query: ParsedUrlQuery }, func: (q: ParsedUrlQuery) => unknown) => {
  const r = func(ctx.query)
  if (r === undefined) {
    return undefined
  }

  return JSON.parse(String(r))
}
