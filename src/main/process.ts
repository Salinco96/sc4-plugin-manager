import { MessageChannelMain, utilityProcess } from "electron/main"

import { getRootPath } from "./utils/paths"

export function createChildProcess<MessageIn, MessageOut>(
  modulePath: string,
  options: {
    cwd?: string
    onClose?: () => void
    onMessage?: (data: MessageOut) => void
  } = {},
): {
  send(data: MessageIn): void
} {
  const { port1, port2 } = new MessageChannelMain()

  const child = utilityProcess.fork(modulePath, [], { cwd: options.cwd ?? getRootPath() })

  child.postMessage({ message: "hello" }, [port1])

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
