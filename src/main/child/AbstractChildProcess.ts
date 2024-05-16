export abstract class AbstractChildProcess<MessageIn, MessageOut> {
  public readonly port: Electron.MessagePortMain

  public constructor(port: Electron.MessagePortMain) {
    this.port = port
    this.port.on("message", event => this.onMessage(event.data))
  }

  protected abstract onMessage(data: MessageIn): void

  protected abstract run(): Promise<void>

  protected send(data: MessageOut): void {
    this.port.postMessage(data)
  }

  public static async execute<MessageIn, MessageOut>(this: {
    new (port: Electron.MessagePortMain): AbstractChildProcess<MessageIn, MessageOut>
  }): Promise<AbstractChildProcess<MessageIn, MessageOut>> {
    return new Promise(resolve => {
      process.parentPort.on("message", async event => {
        const [port] = event.ports

        const instance = new this(port)

        port.start()

        await instance.run()

        resolve(instance)
      })
    })
  }
}
