'use client';
import { useEffect, useState } from 'react';
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
export function PwaRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
  }, []);
  return null;
}
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null),
    [installed, setInstalled] = useState(false);
  useEffect(() => {
    const receive = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const finish = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', receive);
    window.addEventListener('appinstalled', finish);
    const timer = setTimeout(
      () => setInstalled(window.matchMedia('(display-mode: standalone)').matches),
      0,
    );
    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', receive);
      window.removeEventListener('appinstalled', finish);
    };
  }, []);
  if (installed) return <p className="hint">GoIndica instalado neste dispositivo.</p>;
  return (
    <div className="install-app">
      {prompt ? (
        <button
          type="button"
          className="button secondary"
          onClick={async () => {
            await prompt.prompt();
            await prompt.userChoice;
            setPrompt(null);
          }}
        >
          Instalar GoIndica
        </button>
      ) : (
        <details>
          <summary>Usar o GoIndica como aplicativo</summary>
          <p className="hint">
            No menu do navegador, escolha “Instalar aplicativo” ou “Adicionar à tela de início”. No
            iPhone, use Compartilhar no Safari e “Adicionar à Tela de Início”.
          </p>
        </details>
      )}
    </div>
  );
}
