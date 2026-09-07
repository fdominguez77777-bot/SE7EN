import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            position: 'relative',
            zIndex: 20,
            display: 'block',
            opacity: 1,
            visibility: 'visible',
            color: '#f8fbff',
            background: '#7f1d1d',
            border: '1px solid #f87171',
            borderRadius: 12,
            padding: 16,
          }}
        >
          <p style={{ fontWeight: 600, margin: 0 }}>This page failed to load.</p>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#fecaca' }}>
            Refresh and try again. If it continues, sign out and sign back in.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
