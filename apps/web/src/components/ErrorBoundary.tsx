import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <ErrorFallback
          error={this.state.error}
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}

/* ─── Default fallback UI ─────────────────────────────────── */
function ErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "4rem 2rem",
        textAlign: "center",
        gap: "0.75rem",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: "var(--danger-light, #fef2f2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.6rem",
          marginBottom: 4,
        }}
      >
        ⚠️
      </div>
      <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary, #10101a)" }}>
        Something went wrong
      </div>
      <div style={{ fontSize: "0.82rem", color: "var(--text-secondary, #64647a)", maxWidth: 340, lineHeight: 1.5 }}>
        {error.message || "An unexpected error occurred. Try reloading this section."}
      </div>
      <button
        onClick={onRetry}
        style={{
          marginTop: "0.5rem",
          background: "var(--brand-600, #4f46e5)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "0.5rem 1.25rem",
          fontSize: "0.82rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}

/* ─── Section-level boundary (inline, compact) ────────────── */
export function SectionErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div
          style={{
            padding: "1rem",
            borderRadius: 8,
            background: "var(--danger-light, #fef2f2)",
            border: "1px solid var(--danger, #ef4444)",
            fontSize: "0.82rem",
            color: "var(--danger-dark, #991b1b)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>⚠️</span>
          <span>This section failed to load. Refresh the page to try again.</span>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
