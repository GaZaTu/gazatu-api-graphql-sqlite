import jwt from "jsonwebtoken"
import config from "config"

const getJWTSecret = () => {
  if (!config.has("jwtSecret") && (process.env.NODE_ENV !== "production")) {
    return "TEST"
  }

  return config.get("jwtSecret") as string
}

export function verifyJwt<P extends object>(token: string) {
  return new Promise<P>((resolve, reject) => {
    jwt.verify(token, getJWTSecret(), (err, res) => {
      err ? reject(err) : resolve(res as P)
    })
  })
}

export function signJwt<P extends object>(payload: P) {
  return new Promise<string>((resolve, reject) => {
    jwt.sign(payload, getJWTSecret(), (err, res) => {
      err ? reject(err) : resolve(res!)
    })
  })
}
