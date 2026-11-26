import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let message = 'Ocorreu um imprevisto ao carregar esta tela.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        if (parsed.error.includes('Quota exceeded')) {
          message = 'O limite diário gratuito do banco de dados foi atingido. Tente novamente amanhã ou faça upgrade no console do Firebase.';
        } else if (parsed.error.includes('Missing or insufficient permissions')) {
          message = 'Permissão insuficiente para acessar este registro. Verifique se você está autenticado com a conta correta.';
        } else {
          message = parsed.error;
        }
      }
    } catch {
      if (error.message) {
        message = error.message;
      }
    }
    return { hasError: true, message };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4] dark:bg-[#0F1115] p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#171A21] border border-stone-200 dark:border-stone-800 rounded-xl p-8 text-center">
            <h1 className="font-editorial text-3xl font-semibold text-stone-900 dark:text-stone-100">
              Casamento Pleno
            </h1>
            <p className="mt-3 text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              Recarregar aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
