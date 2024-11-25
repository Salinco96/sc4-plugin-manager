import { createRoot } from "react-dom/client"

import App from "./App"

// biome-ignore lint/style/noNonNullAssertion: root must exist
const rootElement = document.getElementById("root")!
const root = createRoot(rootElement)

root.render(<App />)
