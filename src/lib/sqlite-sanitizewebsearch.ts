export const sanitizeWebSearch = (search: string) => {
  let result = ""

  let quoted = false
  let quotedAuto = false
  let quotedStartIdx = 0
  let quotedEndIdx = 0
  let negateNext = false

  for (let i = 0; i <= search.length; i++) {
    // eslint-disable-next-line no-loop-func
    const quote = () => {
      if (!quotedAuto) {
        if (quoted && (i - quotedStartIdx) === 1) {
          quotedStartIdx += 1
          return
        }

        if (!quoted && (i - quotedEndIdx) === 1 && i > 0) {
          quotedEndIdx += 1
          return
        }
      }

      quoted = !quoted

      if (quoted) {
        quotedStartIdx = i
      } else {
        quotedEndIdx = i
      }

      if (quoted && result !== "") {
        if (negateNext) {
          negateNext = false
          result += " NOT "
        } else {
          result += " AND "
        }
      }

      result += "\""

      if (!quoted) {
        result += "*"
        quotedAuto = false
      }
    }

    if (i === search.length) {
      if (quoted) {
        quotedStartIdx = -1
        quote()
      }
      continue
    }

    const chr = search[i]

    if (chr === "\"") {
      quote()
      continue
    }

    if (quoted) {
      if (chr.trim() === "" && quotedAuto) {
        quote()
        continue
      }
    } else {
      if (chr.trim() === "" || chr === "*" || chr === "+" || chr === "-") {
        negateNext = (chr === "-") && !negateNext
        continue
      }

      quotedAuto = true
      quote()
    }

    result += chr
  }

  if (result === "") {
    result = "*"
  }

  return result
}
