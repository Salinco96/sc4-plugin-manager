export abstract class ChildProcess<Data, MessageIn, MessageOut> {
  public readonly data: Data
  public readonly port: Electron.MessagePortMain

  public constructor(port: Electron.MessagePortMain, data: Data) {
    this.data = data
    this.port = port
    this.port.on("message", event => this.onMessage(event.data))
  }

  protected abstract onMessage(data: MessageIn): void

  protected abstract run(): Promise<void>

  protected send(data: MessageOut): void {
    this.port.postMessage(data)
  }

  public static async execute<Data, MessageIn, MessageOut>(this: {
    new (port: Electron.MessagePortMain, data: Data): ChildProcess<Data, MessageIn, MessageOut>
  }): Promise<ChildProcess<Data, MessageIn, MessageOut>> {
    return new Promise(resolve => {
      process.parentPort.on("message", async event => {
        const [port] = event.ports

        const instance = new this(port, event.data)

        port.start()

        await instance.run()

        resolve(instance)
      })
    })
  }
}
