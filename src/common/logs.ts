export interface Logger {
  debug(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
}

export class GroupLogger implements Logger {
  protected readonly group: string
  protected readonly parent: Logger

  public constructor(parent: Logger, group: string) {
    this.parent = parent
    this.group = group
  }

  public debug(message: string, ...args: unknown[]): void {
    this.parent.debug(`[${this.group}] ${message}`, ...args)
  }

  public error(message: string, ...args: unknown[]): void {
    this.parent.error(`[${this.group}] ${message}`, ...args)
  }

  public info(message: string, ...args: unknown[]): void {
    this.parent.info(`[${this.group}] ${message}`, ...args)
  }

  public warn(message: string, ...args: unknown[]): void {
    this.parent.warn(`[${this.group}] ${message}`, ...args)
  }

  public child(group: string): GroupLogger {
    return new GroupLogger(this, group)
  }
}
