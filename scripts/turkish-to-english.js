#!/usr/bin/env node
/**
 * Türkçe karakterleri İngilizce karşılıklarına çevirir
 * Kullanım: node scripts/turkish-to-english.js "Türkçe metin"
 */

const turkishToEnglish = (text) => {
  const charMap = {
    'İ': 'I', 'ı': 'i',
    'Ü': 'U', 'ü': 'u',
    'Ş': 'S', 'ş': 's',
    'Ö': 'O', 'ö': 'o',
    'Ç': 'C', 'ç': 'c',
    'Ğ': 'G', 'ğ': 'g'
  };
  
  return text.replace(/[İıÜüŞşÖöÇçĞğ]/g, (char) => charMap[char] || char);
};

// Komut satırından argüman al
const input = process.argv.slice(2).join(' ');

if (!input) {
  console.log('Kullanim: node scripts/turkish-to-english.js "Turkce metin"');
  process.exit(1);
}

console.log(turkishToEnglish(input));
