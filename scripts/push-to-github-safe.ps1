# GitHub'a otomatik push script'i (Türkçe karakter güvenli)
# Kullanım: .\scripts\push-to-github-safe.ps1 "Commit mesajı"

param(
    [Parameter(Mandatory=$false)]
    [string]$CommitMessage = "Otomatik guncelleme: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
)

# Türkçe karakterleri İngilizce karşılıklarına çevir
function Convert-TurkishToEnglish {
    param([string]$text)
    $text = $text -replace 'İ', 'I'
    $text = $text -replace 'ı', 'i'
    $text = $text -replace 'Ü', 'U'
    $text = $text -replace 'ü', 'u'
    $text = $text -replace 'Ş', 'S'
    $text = $text -replace 'ş', 's'
    $text = $text -replace 'Ö', 'O'
    $text = $text -replace 'ö', 'o'
    $text = $text -replace 'Ç', 'C'
    $text = $text -replace 'ç', 'c'
    $text = $text -replace 'Ğ', 'G'
    $text = $text -replace 'ğ', 'g'
    return $text
}

$SafeCommitMessage = Convert-TurkishToEnglish $CommitMessage

Write-Host "🔄 GitHub'a guncelleme baslatiliyor..." -ForegroundColor Cyan

# Git durumunu kontrol et
$status = git status --porcelain
if (-not $status) {
    Write-Host "ℹ️  Commit edilecek degisiklik yok." -ForegroundColor Yellow
    exit 0
}

# Değişiklikleri ekle
Write-Host "📦 Degisiklikler stage'e ekleniyor..." -ForegroundColor Cyan
git add .

# Commit yap (güvenli mesaj ile)
Write-Host "💾 Commit yapiliyor: $SafeCommitMessage" -ForegroundColor Cyan
git commit -m $SafeCommitMessage

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Commit basarisiz oldu!" -ForegroundColor Red
    exit 1
}

# Push yap
Write-Host "🚀 GitHub'a push ediliyor..." -ForegroundColor Cyan
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Basariyla GitHub'a push edildi!" -ForegroundColor Green
    Write-Host "🔗 Repository: https://github.com/fxrkqnplus/fxrkqn-ai-project" -ForegroundColor Cyan
} else {
    Write-Host "❌ Push basarisiz oldu!" -ForegroundColor Red
    Write-Host "💡 GitHub'da repository olusturdugunuzdan ve remote URL'in dogru oldugundan emin olun." -ForegroundColor Yellow
    exit 1
}
