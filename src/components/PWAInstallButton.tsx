import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 ${
          compact ? 'px-3 py-1.5 text-xs font-medium' : 'px-4 py-2 text-sm font-medium'
        }`}
      >
        {isInstallable ? <Download className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
        <span>{compact ? 'Baixar App' : 'Instalar no Celular'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#171A21] border border-stone-200 dark:border-stone-800 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="pwa-install-title" className="font-editorial text-2xl font-semibold text-stone-900 dark:text-stone-100">
                  Instalar Casamento Pleno
                </h3>
                <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                  Tenha acesso rápido na tela inicial do seu celular, com funcionamento offline e lembretes de vencimentos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm text-stone-700 dark:text-stone-300">
              {isIOS ? (
                <div className="rounded-lg bg-stone-50 dark:bg-stone-900/60 p-4 border border-stone-200 dark:border-stone-800 space-y-2">
                  <p className="font-semibold text-stone-900 dark:text-stone-100">No iPhone ou iPad (Safari)</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-stone-600 dark:text-stone-400">
                    <li>Toque no ícone <strong>Compartilhar</strong> na barra inferior do Safari.</li>
                    <li>Role as opções e toque em <strong>Adicionar à Tela de Início</strong>.</li>
                    <li>Confirme em <strong>Adicionar</strong> para abrir como aplicativo nativo.</li>
                  </ol>
                </div>
              ) : (
                <div className="rounded-lg bg-stone-50 dark:bg-stone-900/60 p-4 border border-stone-200 dark:border-stone-800 space-y-2">
                  <p className="font-semibold text-stone-900 dark:text-stone-100">No Android (Chrome) ou Computador</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-stone-600 dark:text-stone-400">
                    <li>Abra o menu do navegador (três pontos no canto superior).</li>
                    <li>Selecione <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
                    <li>No iPhone/Safari, use <strong>Compartilhar → Adicionar à Tela de Início</strong>.</li>
                  </ol>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-6 w-full py-2.5 text-sm font-medium text-white rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-700 px-3.5 py-2 text-xs font-medium text-white shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5" />
      <span>Modo offline — exibindo dados salvos no aparelho</span>
    </div>
  );
};
