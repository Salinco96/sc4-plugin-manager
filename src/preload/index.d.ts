import { api } from "."

declare global {
  interface Window {
    api: typeof api
  }
}
