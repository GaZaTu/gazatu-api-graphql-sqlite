declare module "sializer" {
  export class Sia {
    public buffer: Buffer

    constructor(opts: { size: number })

    serialize(value: any): Buffer
  }

  export class DeSia {
    constructor(opts: {})

    deserialize(buffer: Buffer): any
  }
}
