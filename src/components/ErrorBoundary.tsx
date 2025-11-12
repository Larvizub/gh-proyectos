import React from 'react';

interface State {
  hasError: boolean;
  error?: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _info: any) {
    // Aquí podríamos enviar el error a un servicio de logging
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-card border rounded-lg p-6 text-center">
            <h2 className="text-xl font-bold mb-2">Algo salió mal</h2>
            <p className="text-sm text-muted-foreground mb-4">Un componente encontró un error. La aplicación no se ha cerrado para que puedas intentar recuperarla.</p>
            <div className="flex items-center justify-center gap-3">
              <button
                className="btn btn-primary"
                onClick={() => window.location.reload()}
              >
                Recargar
              </button>
            </div>
            <details className="mt-4 text-xs text-left text-muted-foreground">
              <summary className="cursor-pointer">Detalles del error</summary>
              <pre className="whitespace-pre-wrap break-words mt-2">{this.state.error?.stack}</pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
