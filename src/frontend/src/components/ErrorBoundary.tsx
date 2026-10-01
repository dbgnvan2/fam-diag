import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Purpose: show what went wrong instead of a blank page when a render or an
 *          effect throws.
 * Spec:    n/a — review 2026-09-30 (DE1-05: an uncaught storage error
 *          unmounted the whole editor and left an empty screen)
 * Tests:   src/frontend/src/components/ErrorBoundary.test.tsx
 *
 * The diagram is also kept in browser storage (written within a second of
 * each change and when the page is hidden), so reloading restores it.
 */
type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Family Diagram stopped with an error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" style={{ padding: 24, maxWidth: 640, margin: '40px auto', fontFamily: 'sans-serif' }}>
        <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
        <p>
          The editor stopped because of an error: <strong>{this.state.error.message}</strong>
        </p>
        <p>
          Your diagram is kept in this browser. Reload the page to continue; if you saved it to a file,
          that file is unchanged.
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
