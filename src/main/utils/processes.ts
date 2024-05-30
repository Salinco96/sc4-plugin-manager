import { MessageChannelMain, utilityProcess } from "electron/main"

export interface ChildProcess<MessageIn> {
  send(data: MessageIn): void
}

export interface ChildProcessOptions<Data, MessageOut> {
  cwd: string
  data?: Data
  onClose?: () => void
  onMessage?: (data: MessageOut) => void
}

export function createChildProcess<Data, MessageIn, MessageOut>(
  modulePath: string,
  options: ChildProcessOptions<Data, MessageOut>,
): ChildProcess<MessageIn> {
  const { port1, port2 } = new MessageChannelMain()

  const child = utilityProcess.fork(modulePath, [], { cwd: options.cwd })

  child.postMessage(options.data, [port1])

  const { onClose, onMessage } = options

  if (onClose) {
    port2.on("close", onClose)
  }

  if (onMessage) {
    port2.on("message", event => onMessage(event.data))
  }

  port2.start()

  return {
    send(data): void {
      port2.postMessage(data)
    },
  }
}
