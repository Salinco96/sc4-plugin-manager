import { Component, ErrorInfo, ReactNode } from "react"

export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = {}
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info)
  }

  override render() {
    if (this.state.error) {
      return <div>{this.state.error.message}</div>
    }

    return this.props.children
  }
}
