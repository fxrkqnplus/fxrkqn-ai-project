#!/bin/bash
# GitHub'a otomatik push script'i
# Kullanım: ./scripts/push-to-github.sh "Commit mesajı"

COMMIT_MESSAGE="${1:-Otomatik güncelleme: $(date '+%Y-%m-%d %H:%M:%S')}"

echo "🔄 GitHub'a güncelleme başlatılıyor..."

# Git durumunu kontrol et
if [ -z "$(git status --porcelain)" ]; then
    echo "ℹ️  Commit edilecek değişiklik yok."
    exit 0
fi

# Değişiklikleri ekle
echo "📦 Değişiklikler stage'e ekleniyor..."
git add .

# Commit yap
echo "💾 Commit yapılıyor: $COMMIT_MESSAGE"
git commit -m "$COMMIT_MESSAGE"

if [ $? -ne 0 ]; then
    echo "❌ Commit başarısız oldu!"
    exit 1
fi

# Push yap
echo "🚀 GitHub'a push ediliyor..."
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ Başarıyla GitHub'a push edildi!"
    echo "🔗 Repository: https://github.com/fxrkqnplus/fxrkqn-ai-project"
else
    echo "❌ Push başarısız oldu!"
    echo "💡 GitHub'da repository oluşturduğunuzdan ve remote URL'in doğru olduğundan emin olun."
    exit 1
fi
