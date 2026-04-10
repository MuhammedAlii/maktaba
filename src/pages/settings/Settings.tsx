import { 
  HiCog,
  HiBell,
  HiLockClosed,
  HiGlobe,
  HiShieldCheck,
  HiSave
} from 'react-icons/hi';

export default function Settings() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-xl shadow-soft p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
            <HiCog className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ayarlar</h1>
            <p className="text-gray-500 mt-1">Sistem ve kullanıcı ayarları</p>
          </div>
        </div>
        
        <div className="space-y-8">
          {/* Genel Ayarlar */}
          <section className="border-b border-gray-200 pb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <HiGlobe className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Genel Ayarlar</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Site Adı
                </label>
                <input
                  type="text"
                  defaultValue="Maktaba Admin"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Dil
                </label>
                <select className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all">
                  <option>Türkçe</option>
                  <option>English</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Site Açıklaması
                </label>
                <textarea
                  rows={3}
                  defaultValue="Kütüphane yönetim sistemi"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                />
              </div>
            </div>
          </section>

          {/* Bildirim Ayarları */}
          <section className="border-b border-gray-200 pb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <HiBell className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Bildirim Ayarları</h2>
            </div>
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    defaultChecked 
                    className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500" 
                  />
                  <div>
                    <span className="font-medium text-gray-900">Email bildirimleri</span>
                    <p className="text-sm text-gray-500">Önemli olaylar için email bildirimi al</p>
                  </div>
                </div>
              </label>
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    defaultChecked 
                    className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500" 
                  />
                  <div>
                    <span className="font-medium text-gray-900">SMS bildirimleri</span>
                    <p className="text-sm text-gray-500">Acil durumlar için SMS bildirimi al</p>
                  </div>
                </div>
              </label>
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500" 
                  />
                  <div>
                    <span className="font-medium text-gray-900">Push bildirimleri</span>
                    <p className="text-sm text-gray-500">Tarayıcı push bildirimlerini etkinleştir</p>
                  </div>
                </div>
              </label>
            </div>
          </section>

          {/* Güvenlik */}
          <section className="border-b border-gray-200 pb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <HiLockClosed className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Güvenlik</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Mevcut Şifre
                </label>
                <input
                  type="password"
                  placeholder="Mevcut şifrenizi girin"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Yeni Şifre
                </label>
                <input
                  type="password"
                  placeholder="Yeni şifrenizi girin"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Yeni Şifre (Tekrar)
                </label>
                <input
                  type="password"
                  placeholder="Yeni şifrenizi tekrar girin"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
              </div>
              <button className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all font-medium shadow-medium">
                Şifreyi Güncelle
              </button>
            </div>
          </section>

          {/* İki Faktörlü Kimlik Doğrulama */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <HiShieldCheck className="w-5 h-5 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">İki Faktörlü Kimlik Doğrulama</h2>
            </div>
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border border-green-200">
              <p className="text-gray-700 mb-4">
                Hesabınızın güvenliğini artırmak için iki faktörlü kimlik doğrulamayı etkinleştirin.
              </p>
              <button className="px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium">
                Etkinleştir
              </button>
            </div>
          </section>

          {/* Kaydet Butonu */}
          <div className="flex justify-end pt-6 border-t border-gray-200">
            <button className="px-8 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all font-semibold shadow-medium flex items-center gap-2">
              <HiSave className="w-5 h-5" />
              <span>Ayarları Kaydet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
