import { Component, ComponentType, ErrorInfo, ReactNode } from "react"

export type ErrorComponentProps = {
  clearError: () => void
  error: Error
}

export type ErrorComponent = ComponentType<ErrorComponentProps>

export type ErrorBoundaryProps = {
  children: ReactNode
  ErrorComponent?: ErrorComponent
}

function DefaultErrorComponent({ error }: ErrorComponentProps) {
  return <>{error.message}</>
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, { error?: Error }> {
  constructor(props: ErrorBoundaryProps) {
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
    const { ErrorComponent = DefaultErrorComponent } = this.props

    if (this.state.error) {
      const props: ErrorComponentProps = {
        clearError: () => this.setState({ error: undefined }),
        error: this.state.error,
      }

      return <ErrorComponent {...props} />
    }

    return this.props.children
  }
}
