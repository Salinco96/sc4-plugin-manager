import { HTMLElement, parse as parseHTML } from "node-html-parser"

export async function readHTML(response: Response): Promise<HTMLElement> {
  const body = await response.text()
  return parseHTML(body)
}

export function toID(name: string): string {
  return name.toLowerCase().replace(/\W+/g, " ").trim().replaceAll(" ", "-")
}

export async function wait(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}
