import { useState } from 'react';
import { HiDeviceMobile, HiX } from 'react-icons/hi';
import { usePwaInstall } from '../../hooks/usePwaInstall';

export default function PwaInstallFab() {
  const { shouldShowFab, canUseInstallPrompt, triggerInstallPrompt, isIos } = usePwaInstall();
  const [helpOpen, setHelpOpen] = useState(false);

  if (!shouldShowFab) return null;

  const handleFabClick = async () => {
    if (canUseInstallPrompt) {
      await triggerInstallPrompt();
      return;
    }
    setHelpOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleFabClick}
        className="fixed z-[60] flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-medium text-white shadow-large ring-1 ring-white/15 transition hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
        style={{
          bottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
          right: 'max(1rem, env(safe-area-inset-right, 0px))',
        }}
        aria-haspopup={!canUseInstallPrompt ? 'dialog' : undefined}
        aria-label="Ana ekrana ekle"
      >
        <HiDeviceMobile className="h-5 w-5 shrink-0" aria-hidden />
        <span>Ana ekrana ekle</span>
      </button>

      {helpOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-help-title"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-large animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id="pwa-install-help-title" className="text-lg font-semibold text-gray-900">
                Ana ekrana ekle
              </h2>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Kapat"
              >
                <HiX className="h-5 w-5" />
              </button>
            </div>

            {isIos ? (
              <ol className="list-decimal space-y-3 pl-5 text-sm text-gray-700">
                <li>
                  Alt kısımdaki <strong>Paylaş</strong> düğmesine dokunun.
                </li>
                <li>
                  Listeden <strong>Ana Ekrana Ekle</strong> seçeneğini seçin.
                </li>
                <li>
                  İsteğe bağlı adı düzenleyip <strong>Ekle</strong> ile onaylayın.
                </li>
              </ol>
            ) : (
              <ol className="list-decimal space-y-3 pl-5 text-sm text-gray-700">
                <li>
                  Tarayıcınızın <strong>menüsünü</strong> açın (genelde sağ üstte ⋮ veya üç çizgi).
                </li>
                <li>
                  <strong>Ana ekrana ekle</strong>, <strong>Kısayol ekle</strong> veya{' '}
                  <strong>Uygulama yükle</strong> seçeneğini seçin.
                </li>
                <li>Onaylayın; ikon ana ekranınızda görünür.</li>
              </ol>
            )}

            <p className="mt-4 text-xs text-gray-500">
              Bazı tarayıcılar otomatik kurulum penceresi göstermez; menüden ekleme gerekir.
            </p>

            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-sm font-medium text-white shadow-sm transition hover:from-emerald-700 hover:to-teal-700"
            >
              Tamam
            </button>
          </div>
        </div>
      )}
    </>
  );
}
