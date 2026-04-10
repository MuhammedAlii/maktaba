# Firebase Kurulum Rehberi

Bu rehber, Firebase'in projeye nasıl entegre edileceğini adım adım açıklar.

## 📋 Adım 1: Firebase Projesi Oluşturma

1. [Firebase Console](https://console.firebase.google.com/) adresine gidin
2. "Add project" (Proje Ekle) butonuna tıklayın
3. Proje adını girin (örn: "maktaba-admin")
4. Google Analytics'i isterseniz açabilirsiniz
5. "Create project" (Proje Oluştur) butonuna tıklayın

## 🔧 Adım 2: Web Uygulaması Eklemek

1. Firebase Console'da projenize gidin
2. Sol menüden ⚙️ (Ayarlar) > **Project settings** seçin
3. Aşağı kaydırın ve **Your apps** bölümüne gelin
4. **Web** (</>) ikonuna tıklayın
5. App nickname girin (örn: "Maktaba Admin Web")
6. Firebase Hosting'i şimdilik işaretlemeyin
7. **Register app** butonuna tıklayın

## 🔑 Adım 3: Firebase Yapılandırma Bilgilerini Alma

Firebase konsolu şu bilgileri verecek:
- `apiKey`
- `authDomain`
- `projectId`
- `messagingSenderId`
- `appId`

Bu bilgileri kopyalayın. (Profil fotoğrafları Cloudinary ile yüklenir; Firebase Storage kullanılmaz.)

## 📁 Adım 4: .env Dosyası Oluşturma

Proje kök dizininde `.env` dosyası oluşturun:

```bash
cp .env.example .env
```

`.env` dosyasını açın ve Firebase bilgilerinizi girin:

```env
VITE_FIREBASE_API_KEY=AIzaSyC...your-api-key
VITE_FIREBASE_AUTH_DOMAIN=maktaba-admin.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=maktaba-admin
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# Profil fotoğrafları — Cloudinary (aşağıdaki bölüme bakın)
VITE_CLOUDINARY_CLOUD_NAME=db2ktqtij
VITE_CLOUDINARY_UPLOAD_PRESET=unsigned_preset_adiniz
```

## 🗄️ Adım 5: Firestore Database Oluşturma

1. Firebase Console'da sol menüden **Firestore Database** seçin
2. **Create database** butonuna tıklayın
3. **Test mode** seçin (geliştirme için, production'da güvenlik kuralları ekleyin)
4. Cloud Firestore location seçin (en yakın bölgeyi seçin)
5. **Enable** butonuna tıklayın

## 📊 Adım 6: Firestore Koleksiyonları Oluşturma

Aşağıdaki koleksiyonları oluşturun:

### 1. `users` Koleksiyonu
```
users (collection)
  └─ {userId} (document)
      ├─ name: string
      ├─ email: string
      ├─ role: string ("user" | "admin")
      └─ createdAt: timestamp
```

### 2. `books` Koleksiyonu
```
books (collection)
  └─ {bookId} (document)
      ├─ title: string
      ├─ author: string
      ├─ category: string
      ├─ isbn: string
      ├─ status: string ("available" | "borrowed")
      └─ createdAt: timestamp
```

### 3. `categories` Koleksiyonu
```
categories (collection)
  └─ {categoryId} (document)
      ├─ name: string
      ├─ description: string
      └─ createdAt: timestamp
```

## 🔒 Adım 7: Firestore Güvenlik Kuralları

### ⚠️ ÖNEMLİ: Geliştirme Aşamasında

**Test Mode kullanın** - Bu, tüm okuma/yazma işlemlerine izin verir (30 gün boyunca).

1. Firestore Database oluştururken **"Start in test mode"** seçeneğini seçin
2. Test mode aktifse, hiçbir güvenlik kuralı eklemenize gerek yok
3. Test mode otomatik olarak 30 gün sonra sona erer

### 🔐 Production İçin Güvenlik Kuralları

Test mode süresi dolduktan sonra veya production'a geçerken güvenlik kuralları ekleyin:

**Firebase Console > Firestore Database > Rules** sekmesine gidin:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Test mode için - GELİŞTİRME AŞAMASINDA KULLANIN
    // DİKKAT: Production'da bu kuralları değiştirin!
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2025, 12, 31);
    }
  }
}
```

**VEYA** daha güvenli production kuralları:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Kullanıcılar koleksiyonu
    match /users/{userId} {
      allow read: if true; // Herkese okuma izni (isteğe bağlı: request.auth != null)
      allow write: if true; // Herkese yazma izni (geliştirme için)
    }
    
    // Kitaplar koleksiyonu
    match /books/{bookId} {
      allow read: if true;
      allow write: if true;
    }
    
    // Kategoriler koleksiyonu
    match /categories/{categoryId} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

**Test Mode Kullanımı İçin:**
- Test mode seçildiyse, Rules sekmesine gitmenize gerek yok
- Test mode otomatik olarak tüm okuma/yazma işlemlerine izin verir

## ☁️ Profil fotoğrafları: Cloudinary

Kullanıcı profil görselleri **Firebase Storage yerine Cloudinary** üzerinden yüklenir; Firestore’da yalnızca dönen `secure_url` saklanır.

1. [Cloudinary Console](https://console.cloudinary.com/) ile giriş yapın; **Cloud name** değerini not edin (ör. `db2ktqtij`).
2. **Settings** (⚙️) → **Upload** → **Upload presets** → **Add upload preset**:
   - **Signing mode:** **Unsigned** (tarayıcıdan doğrudan yükleme için gerekli).
   - **Overwrite:** Unsigned modda çoğu zaman kapalı kalır; sorun değil. Uygulama her yüklemede **benzersiz `public_id`** kullanır; Firestore’daki `photo_url` yeni görsele güncellenir. Eski görseller Cloudinary medya kütüphanede kalabilir; isteğe bağlı olarak panelden silebilir veya kotayı izlersiniz.
   - İmzasız yüklemede **public_id** kullanımına izin verildiğinden emin olun (hata alırsanız preset’te ilgili kısıtları kontrol edin).
3. Oluşan preset’in **adını** kopyalayın.
4. `.env` dosyasına ekleyin:

```env
VITE_CLOUDINARY_CLOUD_NAME=db2ktqtij
VITE_CLOUDINARY_UPLOAD_PRESET=buraya_preset_adiniz
```

**Güvenlik notu:** Unsigned preset tarayıcıda görünür; preset’i yalnızca görsel yükleme ile sınırlayın (ör. `resource_type: image`, klasör kısıtı), mümkünse [Cloudinary upload restrictions](https://cloudinary.com/documentation/upload_presets) ile dosya boyutu ve formatı sınırlandırın. API Secret’ı istemciye koymayın.

## ✅ Adım 8: Test Etme

1. `.env` dosyasını kaydedin
2. Geliştirme sunucusunu yeniden başlatın:
   ```bash
   npm run dev
   ```
3. Tarayıcıda projeyi açın
4. Kullanıcılar, Kitaplar veya Kategoriler sayfasına gidin
5. Yeni bir kayıt eklemeyi deneyin
6. Firebase Console'da Firestore Database'e gidip verilerinizi kontrol edin

## 🐛 Sorun Giderme

### "Firebase: Error (auth/unauthorized-domain)"
- Firebase Console > Authentication > Settings > Authorized domains
- Kendi domain'inizi ekleyin (localhost otomatik eklenir)

### "Permission denied" Hatası
- Firestore güvenlik kurallarını kontrol edin
- Test mode aktif olduğundan emin olun

### Veriler görünmüyor
- Firebase Console'da Network sekmesini kontrol edin
- Tarayıcı konsolundaki hataları kontrol edin
- `.env` dosyasındaki bilgilerin doğru olduğundan emin olun

### Profil fotoğrafı yüklenmiyor (Cloudinary)
- `.env` içinde `VITE_CLOUDINARY_CLOUD_NAME` ve `VITE_CLOUDINARY_UPLOAD_PRESET` dolu mu kontrol edin; değişiklikten sonra `npm run dev`’i yeniden başlatın.
- Preset **Unsigned** olmalı; Cloudinary hata mesajı “Invalid preset” / “Upload preset not found” ise adı veya hesabı kontrol edin.

## 📚 Ek Kaynaklar

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Console](https://console.firebase.google.com/)
- [Cloudinary Upload API](https://cloudinary.com/documentation/image_upload_api_reference)

