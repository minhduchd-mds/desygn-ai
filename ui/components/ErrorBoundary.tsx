import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

interface Props {
  children: ReactNode;
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
    console.error("[DesignReady] render crash:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{
        padding: 24,
        color: "#e2f0ff",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 13,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100vh",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}>
        <span style={{ fontSize: 32, opacity: 0.4 }}>⚠</span>
        <strong style={{ color: "#f5a623" }}>Something went wrong</strong>
        <code style={{
          fontSize: 11,
          color: "#f24822",
          background: "rgba(242,72,34,0.1)",
          padding: "6px 12px",
          borderRadius: 6,
          maxWidth: "90%",
          wordBreak: "break-word",
        }}>
          {this.state.error.message}
        </code>
        <button
          onClick={() => this.setState({ error: null })}
          style={{
            marginTop: 8,
            padding: "8px 20px",
            background: "linear-gradient(135deg, #00d4ff, #0088bb)",
            color: "#000",
            border: "none",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }
}
