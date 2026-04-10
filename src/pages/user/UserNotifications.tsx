import { Link } from 'react-router-dom';
import { HiArrowLeft, HiBell } from 'react-icons/hi';

export default function UserNotifications() {
  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-emerald-600"
      >
        <HiArrowLeft className="w-4 h-4" />
        Ana sayfa
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <HiBell className="w-7 h-7 text-purple-600" />
          Bildirimler
        </h1>
        <p className="text-gray-600 mt-1">
          Bildirimleriniz ve etkinlik geçmişiniz
        </p>
      </div>

      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-8 text-center">
        <HiBell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600">
          Bildirim geçmişi ve etkinlikleriniz daha sonra burada gösterilecek.
        </p>
        <Link to="/" className="inline-block mt-4 text-emerald-600 hover:text-emerald-700 font-medium">
            Ana sayfaya dön
          </Link>
      </div>
    </div>
  );
}
