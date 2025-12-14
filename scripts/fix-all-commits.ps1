# Tum commit mesajlarindaki bozuk Turkce karakterleri duzelt
# Bu script git history'yi degistirir ve force push gerektirir

Write-Host "⚠️  UYARI: Bu islem git history'yi degistirecek ve force push gerektirecek!" -ForegroundColor Yellow
Write-Host "Devam etmek istiyor musunuz? (E/H)" -ForegroundColor Yellow
$confirm = Read-Host

if ($confirm -ne "E" -and $confirm -ne "e") {
    Write-Host "Islem iptal edildi." -ForegroundColor Red
    exit 0
}

Write-Host "Commit mesajlari duzeltiliyor..." -ForegroundColor Cyan

# Git filter-branch ile commit mesajlarini duzelt
git filter-branch -f --msg-filter '
    sed "s/hatalarÄ±/hatalari/g; s/dÃ¼zeltildi/duzeltildi/g; s/uyarÄ±larÄ±/uyarilari/g; s/Ä°lk/Ilk/g; s/yÃ¼klendi/yuklendi/g"
' -- --all

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Commit mesajlari basariyla duzeltildi!" -ForegroundColor Green
    Write-Host "⚠️  Simdi force push yapmaniz gerekiyor:" -ForegroundColor Yellow
    Write-Host "   git push --force-with-lease origin main" -ForegroundColor Cyan
} else {
    Write-Host "❌ Hata olustu!" -ForegroundColor Red
    exit 1
}
