# FXRKQN AI - Yapay Zeka Web Sitesi

Retro, sade ve teknolojik arayüzlü bir genel yapay zeka web sitesi projesi.

## 🚀 Özellikler

- Modern ve retro tasarım
- Next.js 15 ile geliştirilmiş
- Supabase entegrasyonu
- Framer Motion animasyonları
- Responsive tasarım

## 📋 Gereksinimler

- Node.js 20 veya üzeri
- npm veya yarn

## 🛠️ Kurulum

Projeyi klonlayın:

```bash
git clone https://github.com/fxrkqnplus/fxrkqn-ai-project.git
cd fxrkqn-ai-project/fxrkqn-ai
```

Bağımlılıkları yükleyin:

```bash
npm install
```

## 🏃 Geliştirme

Geliştirme sunucusunu başlatın:

```bash
npm run dev
```

Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresini açın.

## 📦 Build

Production build oluşturmak için:

```bash
npm run build
npm start
```

## 🔄 GitHub'a Güncelleme

### İlk Kurulum (Repository Oluşturma)

Eğer GitHub'da repository henüz oluşturulmadıysa:

1. GitHub'da yeni bir repository oluşturun: https://github.com/new
2. Repository adı: `fxrkqn-ai-project`
3. Public veya Private seçin
4. **Initialize with README seçeneğini işaretlemeyin** (zaten README var)
5. Repository oluşturun

Sonra remote URL'i ayarlayın:

```bash
git remote set-url origin https://github.com/fxrkqnplus/fxrkqn-ai-project.git
git push -u origin main
```

### Manuel Güncelleme

Değişikliklerinizi GitHub'a yüklemek için:

```bash
# Değişiklikleri stage'e ekle
git add .

# Commit yap (Türkçe karakterler İngilizce karşılıklarına çevrilmeli)
git commit -m "Degisiklik aciklamasi"

# GitHub'a push et
git push origin main
```

**⚠️ Önemli:** Commit mesajlarında Türkçe karakterler (İ, ü, ş, ö, ç, ğ, ı) bozulabilir. Bu yüzden İngilizce karşılıklarını kullanın:
- İ → I, ı → i
- Ü → U, ü → u
- Ş → S, ş → s
- Ö → O, ö → o
- Ç → C, ç → c
- Ğ → G, ğ → g

### Otomatik Güncelleme Script'i

Daha kolay kullanım için hazır script'ler:

**Windows (PowerShell) - Türkçe karakter güvenli:**
```powershell
.\scripts\push-to-github-safe.ps1 "Türkçe commit mesajı"
```

**Windows (PowerShell) - Normal:**
```powershell
.\scripts\push-to-github.ps1 "Commit mesajı"
```

**Linux/Mac:**
```bash
chmod +x scripts/push-to-github.sh
./scripts/push-to-github.sh "Commit mesajı"
```

Script otomatik olarak:
- ✅ Değişiklikleri kontrol eder
- ✅ Stage'e ekler
- ✅ Commit yapar (güvenli script Türkçe karakterleri otomatik çevirir)
- ✅ GitHub'a push eder

### GitHub Actions CI/CD

Her push işleminde GitHub Actions otomatik olarak:
- ✅ Kodunuzu test eder
- ✅ Linter çalıştırır
- ✅ Projeyi build eder
- ✅ Hataları kontrol eder

Workflow durumunu GitHub repository'nizin "Actions" sekmesinden takip edebilirsiniz.

## 📁 Proje Yapısı

```
fxrkqn-ai/
├── app/              # Next.js app router sayfaları
├── components/       # React bileşenleri
├── lib/             # Yardımcı fonksiyonlar
├── public/          # Statik dosyalar
└── supabase/        # Supabase fonksiyonları
```

## 🔗 Bağlantılar

- [GitHub Repository](https://github.com/fxrkqnplus/fxrkqn-ai-project)
- [Next.js Dokümantasyonu](https://nextjs.org/docs)

## 📝 Lisans

Bu proje bireysel bir projedir.
