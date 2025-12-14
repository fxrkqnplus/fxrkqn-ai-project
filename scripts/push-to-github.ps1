# GitHub'a otomatik push script'i
# Kullanım: .\scripts\push-to-github.ps1 "Commit mesajı"

param(
    [Parameter(Mandatory=$false)]
    [string]$CommitMessage = "Otomatik güncelleme: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
)

Write-Host "🔄 GitHub'a güncelleme başlatılıyor..." -ForegroundColor Cyan

# Git durumunu kontrol et
$status = git status --porcelain
if (-not $status) {
    Write-Host "ℹ️  Commit edilecek değişiklik yok." -ForegroundColor Yellow
    exit 0
}

# Değişiklikleri ekle
Write-Host "📦 Değişiklikler stage'e ekleniyor..." -ForegroundColor Cyan
git add .

# Commit yap
Write-Host "💾 Commit yapılıyor: $CommitMessage" -ForegroundColor Cyan
git commit -m $CommitMessage

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Commit başarısız oldu!" -ForegroundColor Red
    exit 1
}

# Push yap
Write-Host "🚀 GitHub'a push ediliyor..." -ForegroundColor Cyan
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Başarıyla GitHub'a push edildi!" -ForegroundColor Green
    Write-Host "🔗 Repository: https://github.com/fxrkqnplus/fxrkqn-ai-project" -ForegroundColor Cyan
} else {
    Write-Host "❌ Push başarısız oldu!" -ForegroundColor Red
    Write-Host "💡 GitHub'da repository oluşturduğunuzdan ve remote URL'in doğru olduğundan emin olun." -ForegroundColor Yellow
    exit 1
}
