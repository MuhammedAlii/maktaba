# Maktaba Admin Panel

Modern, responsive bir admin paneli uygulaması. React, TypeScript, Vite, Tailwind CSS ve Firebase kullanılarak geliştirilmiştir.

## 🚀 Özellikler

- ✅ **Responsive Tasarım**: Mobil ve masaüstü cihazlarda mükemmel görünüm
- ✅ **Sidebar Menü**: Solda sabit navigasyon menüsü
- ✅ **Header Bar**: Üstte sayfa bilgisi ve kullanıcı bilgileri
- ✅ **CRUD İşlemleri**: Firebase Firestore ile tam CRUD desteği
- ✅ **Düzenli Klasör Yapısı**: Her sayfa kendi klasöründe organize edilmiş
- ✅ **TypeScript**: Tip güvenliği ile daha güvenli kod

## 📋 Gereksinimler

- Node.js 20.19+ veya 22.12+
- npm veya yarn
- Firebase hesabı

## 🛠️ Kurulum

1. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   ```

2. **Firebase Yapılandırması:**
   
   Proje kök dizininde `.env` dosyası oluşturun ve Firebase bilgilerinizi ekleyin:
   
   ```env
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
   VITE_CLOUDINARY_CLOUD_NAME=db2ktqtij
   VITE_CLOUDINARY_UPLOAD_PRESET=unsigned_preset_adiniz
   ```

3. **Firebase Firestore Koleksiyonları:**
   
   Firebase Console'da aşağıdaki koleksiyonları oluşturun:
   - `users` - Kullanıcılar
   - `books` - Kitaplar
   - `categories` - Kategoriler

## 🚦 Kullanım

### Geliştirme Sunucusu

```bash
npm run dev
```

Uygulama `http://localhost:5173` adresinde çalışacaktır.

### Production Build

```bash
npm run build
```

### Preview Build

```bash
npm run preview
```

## 📁 Proje Yapısı

```
src/
├── components/          # Yeniden kullanılabilir bileşenler
│   ├── layout/         # Layout bileşenleri (Sidebar, Header, MainLayout)
│   └── ui/             # UI bileşenleri
├── pages/              # Sayfa bileşenleri
│   ├── dashboard/      # Dashboard sayfası
│   ├── users/          # Kullanıcılar sayfası
│   ├── books/          # Kitaplar sayfası
│   ├── categories/     # Kategoriler sayfası
│   └── settings/       # Ayarlar sayfası
├── config/             # Konfigürasyon dosyaları
│   └── firebase.ts     # Firebase yapılandırması
├── hooks/              # Custom React hooks
├── types/              # TypeScript tip tanımları
├── utils/              # Yardımcı fonksiyonlar
└── App.tsx             # Ana uygulama bileşeni
```

## 🎨 Teknolojiler

- **React 19** - UI kütüphanesi
- **TypeScript** - Tip güvenliği
- **Vite** - Build tool ve dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Sayfa yönlendirme
- **Firebase** - Backend servisleri (Firestore, Auth)

## 📝 Sayfalar

### Dashboard
Ana sayfa, istatistikler ve son aktiviteleri gösterir.

### Kullanıcılar
Kullanıcı yönetimi, ekleme, düzenleme ve silme işlemleri.

### Kitaplar
Kitap yönetimi, CRUD işlemleri.

### Kategoriler
Kategori yönetimi, kart görünümü ile.

### Ayarlar
Uygulama ayarları ve kullanıcı tercihleri.

## 🔧 Özelleştirme

### Menü Öğelerini Değiştirme

`src/components/layout/Sidebar.tsx` dosyasındaki `menuItems` dizisini düzenleyin.

### Sayfa Başlıklarını Değiştirme

`src/components/layout/Header.tsx` dosyasındaki `pageTitles` objesini düzenleyin.

## 📄 Lisans

MIT
