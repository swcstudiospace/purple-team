import { Component, type ReactNode } from 'react';

interface GenUiErrorBoundaryProps {
  /** Raw OpenUI Lang text that the children render. Shown when rendering fails. */
  source: string;
  children: ReactNode;
}

interface GenUiErrorBoundaryState {
  failed: boolean;
}

/**
 * Catches render failures in the GenUI renderer and shows the raw OpenUI Lang
 * text instead. It never rethrows, so a bad program cannot take down the page.
 */
export default class GenUiErrorBoundary extends Component<GenUiErrorBoundaryProps, GenUiErrorBoundaryState> {
  state: GenUiErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): GenUiErrorBoundaryState {
    return { failed: true };
  }

  componentDidUpdate(previous: GenUiErrorBoundaryProps): void {
    // A streamed chunk may make the text renderable again, so retry when it changes.
    if (this.state.failed && previous.source !== this.props.source) {
      this.setState({ failed: false });
    }
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="genui-fallback">
        <p className="genui-muted">This UI could not be rendered. The raw OpenUI Lang output is shown instead.</p>
        <pre>{this.props.source}</pre>
      </div>
    );
  }
}
