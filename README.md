# FXRKQN AI - Yapay Zeka Web Sitesi

**Proje Açıklaması**  
FXRKQN AI, retro‑modern tasarım çizgilerine sahip, Next.js 15 ve React 19 ile geliştirilmiş bir yapay zeka web sitesi projesidir. Uygulama kullanıcı giriş/üye olma işlemlerini Supabase ile yönetir, ardından sohbet arayüzünde kullanıcıların AI modelleriyle etkileşime girerek konuşmalar oluşturmasına olanak tanır. AI altyapısı Cloudflare Workers üzerinde çalışan bir hizmetle sağlanır; Chat mesajlarını işler ve cevapları modeller üzerinden üretir【735795864164768†L0-L15】.

## 🚀 Özellikler

- **Next.js 15**: Sunucu tarafı ve istemci bileşenleriyle modüler bir yapı.
- **Supabase Kimlik Doğrulama**: Kullanıcı kayıt, giriş ve e‑posta doğrulaması yerleşik olarak desteklenir.
- **Sohbet Arayüzü**: Kullanıcı ve model mesajlarını listeleyen modern bir sohbet bileşeni. Konuşmalar sıralanır ve sabitleme/pin özelliği sayesinde önemli konuşmalar liste başında tutulabilir【813009047113745†L340-L349】.
- **Pinleme ve Yedekleme**: Kullanıcılar bir konuşmayı sabitlediğinde `Pick<Conversation, "pinned" | "pinned_at">` tipiyle yalnızca ilgili alanlar güncellenir; böylece linter hataları olmadan veritabanı güncellemeleri yapılır【813009047113745†L340-L349】.
- **Akıllı Başlık Üretimi**: Sohbet mesajı gönderildiğinde Cloudflare Worker, metni analiz ederek 1‑5 kelimelik bir başlık üretir ve bu başlık konuşmanın başlığı olarak kaydedilir.
- **Akışlı Yanıt Gösterimi**: `AnimatedStream` bileşeni AI yanıtını karakter karakter akış halinde göstererek kullanıcılara dinamik bir deneyim sunar.
- **Bildirim Sistemi**: Başarılı veya hatalı işlemler için ekranın üstünde kayan bildirimler.
- **Retro/Modern Tasarım ve Partiküller**: `DecryptedText` ve `Particles` bileşenleri ile sayfalarda retro metin animasyonları ve 3D partikül arkaplanı kullanılır.
- **Supabase Edge Function (ask‑gemini)**: Opsiyonel olarak Google Gemini modelleri üzerinden yanıt üretmek için Supabase fonksiyonu bulunur. Fonksiyon, kullanılabilir Gemini modelini seçer ve gerektiğinde fallback ile yeniden deneyerek üretken AI yanıtı döner【222310416531034†L35-L65】【222310416531034†L93-L104】.
- **GitHub Actions CI/CD**: Her push işleminde test, lint ve build aşamalarını otomatik çalıştıran bir iş akışı (workflow) yapılandırılmıştır.

## 🧠 Mimari

Proje iki ana bileşenden oluşur:

1. **Web Uygulaması (fxrkqn‑ai)**  
   - `app/` klasörü Next.js app router sayfalarını içerir. Örneğin `app/chat/page.tsx`, konuşma listesini, mesaj formunu ve AI yanıtlarını yöneten ana sohbet bileşenidir. Kullanıcı mesajı gönderildiğinde `fetch` çağrısı yaparak Cloudflare Worker üzerinden AI cevabı alır ve dönen JSON verisini `Record<string, unknown>` tipinde parse eder【813009047113745†L580-L590】.
   - `components/` klasörü `AnimatedStream`, `DecryptedText`, `Notification`, `Particles` gibi atomik bileşenleri barındırır.
   - `lib/supabaseClient.ts` dosyası `createClient` fonksiyonuyla Supabase istemcisini başlatır.
   - Ortak stil ve animasyonlar Tailwind CSS ve Framer Motion kullanılarak uygulanır.
   - Kimlik doğrulama ve veritabanı erişimi Supabase üzerinden yapılır; konuşmalar ve mesajlar `conversations` ve `messages` tablolarında saklanır.
   - .env dosyasında `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_AI_WORKER_URL` gibi ayarların tanımlı olması gerekir.

2. **Cloudflare AI Worker (fxrkqn‑ai‑worker)**  
   - `fxrkqn-ai-worker/src/index.ts` dosyasında Cloudflare Workers ortamında çalışan bir AI proxy’si tanımlıdır. Worker, `@cloudflare/ai` kütüphanesini kullanarak belirtilen modeli (`env.MODEL`) çağırır.  Model ismi için `ModelName` tipi `Ai["run"]` parametresinden türetilir; böylece tip güvende kalır【735795864164768†L0-L15】.
   - Worker, gelen talepleri doğrulamak için Supabase access token’ı kontrol eder, günlük istek limitini bir KV veritabanında izler ve aşıldığında hata döndürür.
   - AI yanıtı üretmek için `ai.run(model, ...)` fonksiyonu çağrılır; yanıt içeriği ve başlık 1‑5 kelime olacak şekilde `generateTitle` fonksiyonuyla işlenir.
   - Ortaya çıkan veri JSON olarak döndürülür: `answer`, `title`, `remainingToday`, `maxPerDay` alanlarını içerir.
   - Worker’ı lokal olarak `npm run dev` ile Next.js server’ından bağımsız çalıştırabilir, `wrangler deploy` ile Cloudflare hesabınıza deploy edebilirsiniz.

3. **Supabase Edge Functions (supabase/functions)**  
   - `ask-gemini/index.ts` fonksiyonu, Google Generative Language API üzerinden Gemini modellerini çağıran bir Edge Function’dır. Mevcut modelleri listeleyerek desteklenen bir model seçer ve `generateContent` yöntemiyle yanıt üretir【222310416531034†L35-L65】.  
   - Yanıt geçersiz veya yetersizse, fonksiyon fallback olarak son kullanıcı mesajını tek başına gönderir ve yeni bir yanıt üretir【222310416531034†L186-L224】.  
   - Bu fonksiyon Supabase CLI ile deploy edilerek Cloudflare Worker’e alternatif/yardımcı bir AI katmanı sunar.

## 👋 Gereksinimler

- Node.js 20+ ve npm
- Bir Supabase projesi ve anon anahtar (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- Cloudflare hesabı ve `wrangler` CLI
- (Opsiyonel) Google Cloud hesabı ve Gemini API anahtarı (`GEMINI_API_KEY`)

## 🔧 Kurulum

1. Repositori’yi klonlayın:
   ```bash
   git clone https://github.com/fxrkqnplus/fxrkqn-ai-project.git
   cd fxrkqn-ai-project
   ```
2. Next.js uygulaması için bağımlılıkları kurun:
   ```bash
   cd fxrkqn-ai
   npm install
   ```
3. Cloudflare Worker için bağımlılıkları kurun:
   ```bash
   cd ../fxrkqn-ai-worker
   npm install
   ```
4. Ortam değişkenlerinizi `.env.local` ve Worker yapılandırmasında tanımlayın:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   NEXT_PUBLIC_AI_WORKER_URL=https://<worker-alt-alan>.workers.dev
   SUPABASE_ANON_KEY=...
   SUPABASE_URL=...
   ALLOWED_ORIGIN=http://localhost:3000
   MODEL=@cf/meta/llama-3.1-8b-instruct-fast
   MAX_REQ_PER_DAY=40
   GEMINI_API_KEY=...
   REQUIRE_AUTH=false
   ```
   `GEMINI_API_KEY` sadece ask‑gemini fonksiyonunu kullanıyorsanız gereklidir.

## 🏃 Lokal Geliştirme

- Next.js sunucusunu başlatmak için:
  ```bash
  cd fxrkqn-ai
  npm run dev
  ```
  Ardından [http://localhost:3000](http://localhost:3000) adresine gidin.

- Cloudflare Worker’ı geliştirme modunda başlatmak için:
  ```bash
  cd fxrkqn-ai-worker
  npm run dev
  ```
  Worker varsayılan olarak `localhost:8787` adresinde çalışacaktır; Next.js içinde `NEXT_PUBLIC_AI_WORKER_URL` değişkenini bu adrese ayarlayabilirsiniz.

## 📦 Build ve Yayınlama

- Next.js projesini production için build etmek:
  ```bash
  cd fxrkqn-ai
  npm run build
  npm start
  ```

- Cloudflare Worker’ı deploy etmek:
  ```bash
  cd fxrkqn-ai-worker
  npx wrangler deploy
  ```

- Supabase Edge Function’ı deploy etmek:
  ```bash
  supabase functions deploy ask-gemini
  ```

## 🔁 GitHub Güncelleme

Değişikliklerinizi GitHub’a yüklerken Türkçe karakter problemi yaşamamak için aşağıdaki adımları izleyin:

1. Değişiklikleri stage’e ekleyin ve commit mesajınızı İngilizce karakterlerle yazın:
   ```bash
   git add .
   git commit -m "Degisiklik aciklamasi"
   git push origin main
   ```
2. Windows için `scripts/push-to-github-safe.ps1`, Unix sistemler için `scripts/push-to-github.sh` betiklerini kullanabilirsiniz. Betikler otomatik olarak değişiklikleri, commit mesajını ve push işlemini yapar.

## 📜 Proje Yapısı

```
fxrkqn-ai-project/
├── fxrkqn-ai/               # Next.js 15 uygulaması
│   ├── app/                 # Uygulama sayfaları (page.tsx dosyaları)
│   │   └── chat/page.tsx    # Ana sohbet arayüzü ve mesaj işleme【813009047113745†L580-L590】
│   ├── components/          # Paylaşılan React bileşenleri
│   ├── lib/                 # Yardımcı modüller (ör. supabaseClient)
│   └── public/              # Statik dosyalar
├── fxrkqn-ai-worker/        # Cloudflare Worker
│   └── src/index.ts         # AI proxy ve rate-limit sistemi【735795864164768†L0-L15】
└── supabase/
    └── functions/
        └── ask-gemini/      # Gemini API fonksiyonu【222310416531034†L93-L104】
```

## 🔗 Kaynaklar ve Dokümantasyon

- [Next.js](https://nextjs.org/docs)
- [Supabase](https://supabase.com/docs)
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- [Google Gemini API](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini)

## 📝 Lisans

Bu proje bireysel amaçlarla geliştirilmiştir; herhangi bir resmi lisans altında yayınlanmamıştır. 
