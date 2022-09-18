import { Struct } from "superstruct"

const assertInput = <T, S>(struct: Struct<T, S>, input: unknown) => {
  const [errors] = struct.validate(input)
  if (errors?.message) {
    throw new Error(errors?.message)
  }
}

export default assertInput
