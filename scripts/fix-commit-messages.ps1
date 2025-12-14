# Commit mesajlarindaki bozuk Turkce karakterleri duzelt
# Bu script git history'yi degistirir ve force push gerektirir

Write-Host "⚠️  UYARI: Bu islem git history'yi degistirecek ve force push gerektirecek!" -ForegroundColor Yellow
Write-Host "Devam etmek istiyor musunuz? (E/H)" -ForegroundColor Yellow
$confirm = Read-Host

if ($confirm -ne "E" -and $confirm -ne "e") {
    Write-Host "Islem iptal edildi." -ForegroundColor Red
    exit 0
}

# Git rebase script'i olustur
$rebaseScript = @"
pick acab1f3 Turkce karakter sorunu icin guvenli push script'i eklendi
reword 35eba7b TypeScript build hatalarÄ± dÃ¼zeltildi: FunctionsResponse tipi ve Framer Motion variants
reword 6541f1e Linter hatalarÄ± dÃ¼zeltildi: any tipleri ve React Hook dependency uyarÄ±larÄ±
pick c70bbd7 GitHub Actions CI/CD pipeline eklendi
reword 29f445e Ä°lk commit: Proje GitHub'a yÃ¼klendi
pick 6ab4024 Proje D sürücüsüne taşındı
"@

Write-Host "Rebase script'i olusturuldu. Manuel olarak devam etmeniz gerekecek." -ForegroundColor Cyan
Write-Host "Asagidaki komutlari sirasiyla calistirin:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. git rebase -i 6ab4024" -ForegroundColor Green
Write-Host "2. Editor'de 'reword' satirlarindaki commit mesajlarini duzeltin:" -ForegroundColor Green
Write-Host "   - TypeScript build hatalari duzeltildi: FunctionsResponse tipi ve Framer Motion variants" -ForegroundColor Yellow
Write-Host "   - Linter hatalari duzeltildi: any tipleri ve React Hook dependency uyarilari" -ForegroundColor Yellow
Write-Host "   - Ilk commit: Proje GitHub'a yuklendi" -ForegroundColor Yellow
Write-Host "3. git push --force-with-lease origin main" -ForegroundColor Green
