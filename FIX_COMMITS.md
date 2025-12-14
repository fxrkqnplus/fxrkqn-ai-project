# Commit Mesajlarını Düzeltme Rehberi

Bu rehber, GitHub repository'deki bozuk Türkçe karakterleri içeren commit mesajlarını düzeltmek için hazırlanmıştır.

## Düzeltilecek Commit'ler

1. `35eba7b` - "TypeScript build hatalarÄ± dÃ¼zeltildi" → "TypeScript build hatalari duzeltildi"
2. `6541f1e` - "Linter hatalarÄ± dÃ¼zeltildi" → "Linter hatalari duzeltildi"
3. `29f445e` - "Ä°lk commit: Proje GitHub'a yÃ¼klendi" → "Ilk commit: Proje GitHub'a yuklendi"

## Yöntem 1: Git Rebase (Önerilen)

### Adım 1: Interactive Rebase Başlat

```powershell
cd "D:\Sistem (SSD)\fxrkqn-ai-project\fxrkqn-ai"
git rebase -i 6ab4024
```

### Adım 2: Editor'de Değişiklik Yap

Açılan editor'de şu satırları bulun ve `pick` yerine `reword` yazın:

```
pick acab1f3 Turkce karakter sorunu icin guvenli push script'i eklendi
reword 35eba7b TypeScript build hatalarÄ± dÃ¼zeltildi: FunctionsResponse tipi ve Framer Motion variants
reword 6541f1e Linter hatalarÄ± dÃ¼zeltildi: any tipleri ve React Hook dependency uyarÄ±larÄ±
pick c70bbd7 GitHub Actions CI/CD pipeline eklendi
reword 29f445e Ä°lk commit: Proje GitHub'a yÃ¼klendi
pick 6ab4024 Proje D sürücüsüne taşındı
```

### Adım 3: Commit Mesajlarını Düzelt

Her `reword` için açılan editor'de commit mesajını düzeltin:

- `35eba7b`: "TypeScript build hatalari duzeltildi: FunctionsResponse tipi ve Framer Motion variants"
- `6541f1e`: "Linter hatalari duzeltildi: any tipleri ve React Hook dependency uyarilari"
- `29f445e`: "Ilk commit: Proje GitHub'a yuklendi"

### Adım 4: Force Push

```powershell
git push --force-with-lease origin main
```

## Yöntem 2: Otomatik Script (Deneysel)

```powershell
.\scripts\fix-commits-manual.ps1
```

**Not:** Bu script deneyseldir ve manuel kontrol gerektirebilir.

## Önemli Uyarılar

⚠️ **Bu işlem git history'yi değiştirir!**
- Eğer başkaları bu repository'yi kullanıyorsa, onlara haber vermelisiniz
- Force push yapmadan önce yedek alın
- `--force-with-lease` kullanın (daha güvenli)

## Alternatif: Yeni Commit'ler İçin

Gelecekteki commit'ler için Türkçe karakter sorununu önlemek için:

```powershell
.\scripts\push-to-github-safe.ps1 "Türkçe commit mesajı"
```

Bu script otomatik olarak Türkçe karakterleri İngilizce karşılıklarına çevirir.
