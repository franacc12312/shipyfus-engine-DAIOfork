import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-6">
            <div className="bg-zinc-950 border border-terminal-red/30 rounded-lg p-6">
              <h3 className="text-terminal-red text-sm font-bold tracking-wider mb-2">ERROR</h3>
              <p className="text-xs text-zinc-400 mb-4">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="text-xs text-terminal-green border border-terminal-green/30 rounded px-3 py-1.5 hover:bg-terminal-green/10 transition"
              >
                RETRY
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
