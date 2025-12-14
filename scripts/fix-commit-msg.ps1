# Commit mesajini duzeltmek icin editor script'i
param([string]$file)

$content = Get-Content $file -Raw

# Bozuk Turkce karakterleri duzelt
$content = $content -replace 'hatalarÄ±', 'hatalari'
$content = $content -replace 'dÃ¼zeltildi', 'duzeltildi'
$content = $content -replace 'uyarÄ±larÄ±', 'uyarilari'
$content = $content -replace 'Ä°lk', 'Ilk'
$content = $content -replace 'yÃ¼klendi', 'yuklendi'

Set-Content $file $content -NoNewline
