# 🔥 Firebase Hızlı Kurulum (Test Mode)

Bu rehber, Firebase'i test mode ile hızlıca kurmak için hazırlanmıştır.

## ✅ Adım Adım Kurulum

### 1️⃣ Firebase Projesi Oluştur
1. https://console.firebase.google.com/ adresine git
2. "Add project" tıkla
3. Proje adı gir (örn: "maktaba-admin")
4. Analytics'i istersen aç (opsiyonel)
5. "Create project" tıkla

### 2️⃣ Web Uygulaması Ekle
1. Proje oluştuktan sonra "Web" (</>) ikonuna tıkla
2. App nickname gir: "Maktaba Admin Web"
3. Firebase Hosting'i işaretleme (şimdilik gerekmez)
4. "Register app" tıkla
5. **Config bilgilerini kopyala** (şu şekilde görünür):
   ```javascript
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "...",
     projectId: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

### 3️⃣ Firestore Database Oluştur (TEST MODE)
1. Sol menüden **"Firestore Database"** seç
2. **"Create database"** tıkla
3. ⚠️ **ÖNEMLİ:** **"Start in test mode"** seçeneğini seç
4. Cloud Firestore location seç (en yakın bölge)
5. **"Enable"** tıkla

### 4️⃣ .env Dosyasını Doldur
Proje kök dizinindeki `.env` dosyasını aç ve Firebase config bilgilerini yapıştır:

```env
VITE_FIREBASE_API_KEY=AIzaSyC... (config'ten kopyala)
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
VITE_CLOUDINARY_CLOUD_NAME=db2ktqtij
VITE_CLOUDINARY_UPLOAD_PRESET=unsigned_preset_adiniz
```

### 5️⃣ Sunucuyu Yeniden Başlat
```bash
# Çalışan sunucuyu durdur (Ctrl+C)
npm run dev
```

### 6️⃣ Test Et
1. Tarayıcıda http://localhost:5173 aç
2. Kullanıcılar sayfasına git
3. "Yeni Kullanıcı" butonuna tıkla
4. Formu doldur ve kaydet
5. Firebase Console > Firestore Database'e git
6. Verinin eklendiğini kontrol et

## ✅ Test Mode Avantajları
- ✅ Tüm okuma/yazma işlemlerine otomatik izin
- ✅ Güvenlik kuralları eklemeye gerek yok
- ✅ 30 gün boyunca geçerli
- ✅ Geliştirme için ideal

## ⚠️ Önemli Notlar
- Test mode 30 gün sonra sona erer
- Production'a geçerken güvenlik kuralları eklemeniz gerekir
- Test mode sadece geliştirme için uygundur

## 🐛 Sorun Giderme

### "Permission denied" Hatası
- Firestore Database'in **test mode**'da olduğundan emin ol
- Firebase Console > Firestore Database > Rules sekmesine git
- Test mode aktifse, Rules sekmesi boş olabilir veya tarih bazlı bir kural görünür

### Veriler görünmüyor
- `.env` dosyasını kaydettiğinizden emin olun
- Sunucuyu yeniden başlattınız mı?
- Firebase Console'da koleksiyonlar oluşturuluyor mu?

### "Access to storage is not allowed"
- Bu hata genellikle güvenlik kuralları ile ilgilidir
- Test mode aktif olduğundan emin olun
- Sunucuyu yeniden başlatmayı deneyin

