# Commit mesajlarini duzeltmek icin manuel script
# Bu script her commit'i tek tek duzeltir

Write-Host "⚠️  UYARI: Bu islem git history'yi degistirecek ve force push gerektirecek!" -ForegroundColor Yellow
Write-Host "Devam etmek istiyor musunuz? (E/H)" -ForegroundColor Yellow
$confirm = Read-Host

if ($confirm -ne "E" -and $confirm -ne "e") {
    Write-Host "Islem iptal edildi." -ForegroundColor Red
    exit 0
}

# Commit mesajlarini duzelt
Write-Host "Commit mesajlari duzeltiliyor..." -ForegroundColor Cyan

# Her commit'i duzelt
$commits = @(
    @{hash="35eba7b"; old="TypeScript build hatalarÄ± dÃ¼zeltildi: FunctionsResponse tipi ve Framer Motion variants"; new="TypeScript build hatalari duzeltildi: FunctionsResponse tipi ve Framer Motion variants"},
    @{hash="6541f1e"; old="Linter hatalarÄ± dÃ¼zeltildi: any tipleri ve React Hook dependency uyarÄ±larÄ±"; new="Linter hatalari duzeltildi: any tipleri ve React Hook dependency uyarilari"},
    @{hash="29f445e"; old="Ä°lk commit: Proje GitHub'a yÃ¼klendi"; new="Ilk commit: Proje GitHub'a yuklendi"}
)

foreach ($commit in $commits) {
    Write-Host "Duzeltiliyor: $($commit.hash)" -ForegroundColor Yellow
    git rebase -i "$($commit.hash)^" --exec "git commit --amend -m '$($commit.new)'"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Hata: $($commit.hash) duzeltilemedi" -ForegroundColor Red
        Write-Host "Manuel olarak devam etmeniz gerekebilir." -ForegroundColor Yellow
        break
    }
}

Write-Host "✅ Tum commit mesajlari duzeltildi!" -ForegroundColor Green
Write-Host "⚠️  Simdi force push yapmaniz gerekiyor:" -ForegroundColor Yellow
Write-Host "   git push --force-with-lease origin main" -ForegroundColor Cyan
