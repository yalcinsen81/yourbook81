import { Component, type ErrorInfo, type ReactNode } from "react";
import { translate, getSavedUiLanguage } from "../i18n";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Bileşen çökmesini yakalar; tüm uygulama yerine sadece bu alanı güvenli fallback ile değiştirir. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary yakaladı:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 bg-[var(--app-bg)] text-[var(--ink)]">
          <span className="font-mono text-xl font-bold text-[var(--accent)]">!</span>
          <h2 className="font-gelica text-2xl font-semibold lowercase">
            {translate(getSavedUiLanguage(), "sys.error_title")}
          </h2>
          <p className="max-w-md text-center font-geist text-xs text-[var(--ink-soft)]">
            {translate(getSavedUiLanguage(), "sys.error_desc")} {translate(getSavedUiLanguage(), "sys.error_retry")}
          </p>
          <pre className="max-w-md overflow-x-auto rounded-[8px] border border-[var(--border-ink)] bg-[var(--paper)] p-3 font-geist text-[11px] text-[var(--ink-soft)]">
            {this.state.error.message}
          </pre>
          <button onClick={() => window.location.reload()} className="btn-pill-orange text-xs">
            <span>{translate(getSavedUiLanguage(), "sys.reload")}</span>
          </button>
          <button
            onClick={() => this.setState({ error: null })}
            className="btn-pill-superr text-xs"
          >
            <span>{translate(getSavedUiLanguage(), "sys.retry")}</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
