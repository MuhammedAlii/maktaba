# Vercel’e dağıtım (Maktaba)

Vite + React SPA; Firebase ve Cloudinary istemci tarafında `VITE_*` ortam değişkenleriyle yapılandırılır.

## Önerilen: Git’ten doğrudan deploy (GitHub)

Kodunuz zaten bir Git remote’ta ise (ör. `github.com/MuhammedAlii/maktaba`), Vercel her `push` sonrası otomatik build eder; CLI şart değildir.

1. **[vercel.com](https://vercel.com)** hesabıyla giriş yapın → **Add New…** → **Project**.
2. **Import Git Repository**: GitHub’ı seçin, ilk seferde **Install** ile Vercel GitHub uygulamasına erişim verin (tüm repolar veya yalnızca `maktaba`).
3. Listeden **maktaba** reposunu seçin → **Import**.
4. Vercel ayarları kökteki `vercel.json` ile hizalanır:
   - **Framework Preset:** Vite (otomatik seçilebilir)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Root Directory:** `.` (monorepo değilse)
5. **Deploy** deyin. İlk build biter bitmez Preview/Production URL görünür.
6. **Settings → Environment Variables:** Bölüm 2’deki tüm `VITE_*` değişkenlerini ekleyin (Production ve istiyorsanız Preview için). Kaydettikten sonra **Deployments** → son deployment → **⋯** → **Redeploy** (env’lerin derlemeye girmesi için).
7. **Production branch:** **Settings → Git** içinde genelde `main`; bu dala her merge/push production deploy tetikler. Diğer dallar ve pull request’ler için Vercel otomatik **Preview** URL üretir.

Firebase yetkili alanlar ve Google API referrer ayarları için aşağıdaki bölümlere bakın.

---

## Git olmadan: Vercel CLI (bilgisayardan yükleme)

Repo’yu Git’e bağlamadan, projeyi doğrudan Vercel’e göndermek için:

1. **Node 20+** kullanın (Vite 7 ile uyumlu).
2. Proje kökünde (`maktaba` klasörü):

```bash
npx vercel login
npx vercel
```

3. Sorulara cevap verin: hesap, **yeni proje** veya mevcut projeye bağlama, proje adı, kök dizin `.` olarak kalsın.
4. İlk çalıştırma genelde bir **önizleme (Preview)** URL’si üretir.
5. **Önemli:** `.env` dosyanız sunucuya **otomatik gitmez**. [vercel.com](https://vercel.com) → projeniz → **Settings → Environment Variables** bölümünden bölüm 2’deki tüm `VITE_*` değişkenlerini ekleyin, sonra **Deployments** → son deployment → **⋯ → Redeploy** (build’in env’leri gömmesi için).
6. Canlı (production) adresi için:

```bash
npx vercel --prod
```

Yerelde `.vercel/` klasörü oluşur (CLI’nın proje eşlemesi); `.gitignore` içinde yoksa ekleyin.

İsterseniz değişkenleri terminalden de ekleyebilirsiniz: `npx vercel env add VITE_FIREBASE_API_KEY` (ortam: Production seçin).

---

## 1. Yapılandırma özeti (`vercel.json`)

Kökteki `vercel.json` build komutunu, çıktı klasörünü ve SPA için tüm yolları `index.html`e yönlendirmeyi tanımlar (React Router `/admin`, `/users` vb.). Git ile import ederken bu değerler projeye uygulanır.

## 2. Vercel ortam değişkenleri

**Settings → Environment Variables** bölümüne, `.env` içindekiyle **aynı isimlerle** ekleyin (Production / Preview isteğe göre):

| Değişken | Açıklama |
|----------|----------|
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project settings → Your apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | Genelde `proje.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Proje kimliği |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Config’teki değer |
| `VITE_FIREBASE_APP_ID` | Config’teki app id |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Unsigned upload preset adı |
| `VITE_EMAILJS_*` | Şifre sıfırlama e-postası kullanıyorsanız (opsiyonel) |

**Önemli:** Vite sadece `VITE_` ile başlayan değişkenleri derlemeye dahil eder. Değişken ekledikten sonra **yeniden deploy** gerekir.

## 3. Firebase — yetkili alan adları (zorunlu)

Canlı URL’den giriş ve Auth’un çalışması için:

1. [Firebase Console](https://console.firebase.google.com/) → projeniz → **Authentication** → **Settings** → **Authorized domains**
2. Şunları ekleyin:
   - `your-app.vercel.app` (Vercel’in verdiği alt alan adı)
   - Özel alan adı kullanacaksanız onu da (ör. `app.example.com`)
3. `localhost` genelde zaten listededir; geliştirme için yeterlidir.

Firestore / Storage kurallarınız production için uygun olmalı (test mode süresi dolmuşsa kuralları güncelleyin).

**Not:** “Yetkili alan adları” ile aşağıdaki “API anahtarı referrer” ayarı **farklı** yerlerdedir; ikisi de genelde production için gereklidir.

## 4. Google Cloud — tarayıcı API anahtarı (Firebase istekleri)

Firebase Web SDK’nın kullandığı `apiKey`, aslında **Google Cloud’daki bir API anahtarıdır**. Bu anahtara **HTTP referrer** (web sitesi) kısıtı verdiyseniz, **production domain’inizi de listeye eklemeniz** gerekir; aksi halde canlı sitede Firestore / Auth istekleri reddedilebilir.

1. [Google Cloud Console](https://console.cloud.google.com/) → doğru projeyi seçin (Firebase projenizle aynı).
2. **APIs & Services** → **Credentials**.
3. Firebase Web uygulamanızın kullandığı **Browser key** (veya adı “Browser key” / “Auto created…” olabilir) → **Edit**.
4. **Application restrictions** → **HTTP referrers (web sites)**.
5. **Website restrictions** listesine şunları ekleyin (kendi adreslerinizle değiştirin):

| Ortam | Örnek referrer |
|--------|----------------|
| Geliştirme | `http://localhost:5173/*` |
| Vercel production | `https://sizin-proje.vercel.app/*` |
| Özel domain | `https://app.sizindomain.com/*` |

6. **Vercel Preview** (her PR için farklı `xxx-git-branch-team.vercel.app` URL’leri) kullanıyorsanız: ya her önizleme URL’sini tek tek ekleyin ya da geçici olarak `https://*.vercel.app/*` kullanın (Google’ın wildcard kurallarına uygun; güvenlik ile pratiklik arasında denge sizde).

7. **API restrictions:** “Restrict key” seçiliyse, en azından Firebase’in ihtiyaç duyduğu API’ler açık olmalı (çoğu kurulumda **Firebase-related APIs** veya Google’ın önerdiği set). Çok daraltırsanız istemci hata verebilir.

**Özet:** Localhost için ne eklediyseniz, **canlı site için de aynı anahtarda `https://...vercel.app/*` (ve varsa özel domain)** eklenmeli. İkisi birbirinin yerine geçmez: **Authorized domains** (Firebase Auth) + **HTTP referrer** (API key) birlikte düşünülür.

## 5. Cloudinary

Unsigned upload preset zaten tarayıcıdan çalışır. Canlı domain için ekstra CORS dosyası gerekmez (Firebase Storage CORS’u kullanmıyorsunuz).

İsterseniz Cloudinary **Allowed fetch domains / upload restrictions** ile yalnızca kendi domain’inizi sınırlayabilirsiniz (güvenlik sıkılaştırması).

## 6. Dağıtım sonrası kontrol

- Ana sayfa ve `/admin` açılıyor mu?
- Giriş yapılabiliyor mu? (Yetkili alan ekli mi?)
- Profil fotoğrafı yükleme çalışıyor mu?

## 7. Özel alan adı

Vercel → Project → **Domains** ile domain ekleyin; DNS’i Vercel’in talimatına göre ayarlayın. Ardından Firebase **Authorized domains** listesine bu domaini de ekleyin.
