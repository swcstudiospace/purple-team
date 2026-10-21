import { Component, type ErrorInfo, type ReactNode } from 'react';

interface PanelErrorBoundaryProps {
  /** Human section name used in the fallback copy and console report. */
  section: string;
  children: ReactNode;
}

interface PanelErrorBoundaryState {
  error: Error | null;
}

/**
 * Per-section crash isolation: a render error in one panel shows a recovery
 * card in place instead of unmounting the whole app shell. Reset when the
 * section changes (remount via key) or when the user dismisses the card.
 */
class PanelErrorBoundary extends Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  state: PanelErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Console only — no network reporting exists by design for this
    // single-operator tool. Message text is shown below; component stack
    // stays in the console for diagnosis.
    console.error(`[${this.props.section}] render error:`, error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    return (
      <div className="panel-error" role="alert">
        <h2 className="panel-error__title">{this.props.section} hit a display error</h2>
        <p className="panel-error__detail">{error.message}</p>
        <div className="panel-error__actions">
          <button type="button" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
          <button type="button" onClick={() => window.location.reload()}>
            Reload app
          </button>
        </div>
      </div>
    );
  }
}

export default PanelErrorBoundary;
