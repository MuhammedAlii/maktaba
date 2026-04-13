import { useCallback, useEffect, useState } from 'react';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function getIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    nav.standalone === true
  );
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Ana ekrana ekle / PWA kurulumu: tarayıcı desteğine göre prompt veya manuel yönlendirme.
 */
export function usePwaInstall() {
  const [isStandalone, setIsStandalone] = useState(getIsStandalone);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const updateStandalone = () => setIsStandalone(getIsStandalone());
    const mqStandalone = window.matchMedia('(display-mode: standalone)');
    const mqFullscreen = window.matchMedia('(display-mode: fullscreen)');
    mqStandalone.addEventListener('change', updateStandalone);
    mqFullscreen.addEventListener('change', updateStandalone);
    return () => {
      mqStandalone.removeEventListener('change', updateStandalone);
      mqFullscreen.removeEventListener('change', updateStandalone);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const sync = () => setIsMobileViewport(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  useEffect(() => {
    const onInstalled = () => setDeferredPrompt(null);
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  const triggerInstallPrompt = useCallback(async () => {
    if (!deferredPrompt) return { outcome: 'unavailable' as const };
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return { outcome: outcome === 'accepted' ? ('accepted' as const) : ('dismissed' as const) };
  }, [deferredPrompt]);

  const shouldShowFab = !isStandalone && isMobileViewport;

  return {
    shouldShowFab,
    canUseInstallPrompt: deferredPrompt !== null,
    triggerInstallPrompt,
    isIos: isIosDevice(),
  };
}
