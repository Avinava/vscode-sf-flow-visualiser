import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-6">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            
            <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
              The flow visualizer encountered an unexpected error.
            </p>

            {this.state.error && (
              <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-lg text-left mb-6 overflow-auto max-h-32 text-xs font-mono text-red-600 dark:text-red-400 border border-slate-200 dark:border-slate-700">
                {this.state.error.toString()}
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <RefreshCw size={16} />
              Reload Visualizer
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
