// supabase/functions/generate-title/index.ts
import { corsHeaders } from '../_shared/cors.ts';

console.log("generate-title cold start");

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error("FATAL: GEMINI_API_KEY is not set in Supabase secrets!");

    const body = await req.json().catch(() => null);
    const firstMessageRaw = String(body?.firstMessage ?? '').trim();
    if (!firstMessageRaw) {
      return new Response(JSON.stringify({ message: "Request must include { firstMessage: string }" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const MODEL_ID = Deno.env.get('GEMINI_TITLE_MODEL') || 'models/gemini-2.5-pro';
    const endpoint = `https://generativelanguage.googleapis.com/v1/${MODEL_ID}:generateContent`;

    const prompt = `
You are a Turkish title generator. Given a TURKISH user message, output a SHORT (2-5 words preferred) conversation title in TURKISH.
RULES:
- OUTPUT ONLY the title text (no JSON, no quotes, no explanation, no punctuation at the end).
- Prefer concise noun phrases; remove verbs and filler words.
- Sentence-case: first token capitalized; preserve capitalization for proper nouns / technical words (e.g., React, useEffect, Türkiye, İstanbul).
- For yes/no questions, prefer "hakkında soru" or append "soru".
- For "örnek" requests include "örneği" (example).
- For "nasıl/çöz" requests include "çözümleri" or "çözüm".
- Don't echo the whole user sentence; don't copy trailing verbs like "verebilir misin" or "düşünüyorum".
EXAMPLES:
Bana Türkiye hakkında bilgi verebilir misin? -> Türkiye hakkında bilgi
Sence Türkiye bir ülke mi? -> Türkiye hakkında soru
Bana React'ta useEffect hook'unu örneklerle açıklar mısın? -> React useEffect örneği
İş görüşmesi için hangi kıyafetleri tercih etmeliyim? -> İş görüşmesi kıyafet tercihi
Ülkemizde elektrik sorununu nasıl çözebiliriz? -> Elektrik sorunu çözümleri
Hava durumu nasıl olacak yarın istanbulda sabah? -> Yarın İstanbul'da hava durumu
Return only the title text.
`.trim();

    const genBody = {
      contents: [{ role: 'user', parts: [{ text: `${prompt}\n\nUser message:\n"${firstMessageRaw}"` }] }],
      generation_config: { maxOutputTokens: 40, temperature: 0.0, topP: 0.0 }
    };

    const genRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify(genBody)
    });

    const rawText = await genRes.text().catch(() => '');
    let genJson: any = null;
    try { genJson = JSON.parse(rawText); } catch { genJson = null; }
    console.log('generate-title -> google status:', genRes.status, genRes.statusText);
    console.log('generate-title -> google raw snippet:', (rawText || '').slice(0, 1500));

    function extractFromResponse(resp: any): string | null {
      if (!resp) return null;
      if (Array.isArray(resp.candidates)) {
        for (const c of resp.candidates) {
          const parts = c?.content?.parts;
          if (Array.isArray(parts)) {
            const texts = parts.map((p: any) => (typeof p === 'string' ? p : (p?.text ?? ''))).filter(Boolean);
            if (texts.length) return texts.join(' ').trim();
          }
          const ctext = c?.content?.text ?? c?.content?.outputText ?? c?.outputText;
          if (typeof ctext === 'string' && ctext.trim()) return ctext.trim();
        }
      }
      if (typeof resp.outputText === 'string' && resp.outputText.trim()) return resp.outputText.trim();
      if (typeof resp.renderedContent === 'string' && resp.renderedContent.trim()) return resp.renderedContent.trim();
      function deepFind(o: any): string | null {
        if (!o) return null;
        if (typeof o === 'string') return o;
        if (Array.isArray(o)) {
          for (const el of o) { const s = deepFind(el); if (s) return s; }
        } else if (typeof o === 'object') {
          for (const k of Object.keys(o)) { const s = deepFind(o[k]); if (s) return s; }
        }
        return null;
      }
      return (deepFind(resp) || null);
    }

    // ---------- text helpers (no \p{L}) ----------
    const turLocale = 'tr';
    const SAFE_CHAR_CLASS = "A-Za-zÀ-ÖØ-öø-ÿÇĞİÖŞÜçğıöşüİı0-9\\s\\-\\.,'’";
    const SAFE_CHAR_RE = new RegExp(`[^${SAFE_CHAR_CLASS}]`, 'g');
    const SAFE_TOKEN_RE = new RegExp(`[^A-Za-zÀ-ÖØ-öø-ÿÇĞİÖŞÜçğıöşüİı0-9'’]`, 'g');

    function normalizeText(s: string) {
      return String(s || '')
        .replace(/\r?\n+/g, ' ')
        .replace(/[“”"“”]+/g, '')
        .replace(SAFE_CHAR_RE, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    const STOPWORDS = new Set([
      've','ile','da','de','mi','mı','mu','mü','bir','bu','o','ben','sen','siz','biz',
      'bana','sence','lütfen','acaba','neden','kadar','için','gibi','merhaba','selam','lütfen','please'
    ]);

    const COMMON_VERBS = new Set([
      'olmak','etmek','yapmak','sormak','almak','gitmek','gelmek','bilmek','görmek','kullanmak','istemek','düşünmek','vermek','söylemek'
    ]);

    const VERB_SUFFIXES = ['mak','mek','ma','me','maya','meye','mayı','meyi','ması','mesi','mış','miş','iyor','ıyor','di','dı','du','dü','acak','ecek','muş','miş','ebil','abilir','ebilir','ebiliriz','ebiliriz','verebilir','verir','ver'];

    const TIME_LOC = new Set(['yarın','bugün','sabah','akşam','öğle','istanbul','ankara','izmir','antalya','hafta','haftasonu','dün','geçen','şimdi']);

    const FINANCE = new Set(['hisse','kripto','borsa','yatırım','döviz','altın','coin']);
    const WEATHER = new Set(['hava','sıcaklık','rüzgar','yağmur','yağış','bulut','sis']);

    const originalTokensFull = firstMessageRaw.replace(/\s+/g, ' ').split(' ').filter(Boolean);
    const originalTokens = originalTokensFull.map(t => t.replace(SAFE_TOKEN_RE, ''));
    const originalLower = originalTokens.map(t => t.toLocaleLowerCase(turLocale));
    const originalCasingMap = new Map<string,string>();
    for (let i = 0; i < originalTokens.length; i++) {
      const key = originalLower[i];
      if (key && !originalCasingMap.has(key)) originalCasingMap.set(key, originalTokens[i]);
    }
    function preserveOriginal(word: string) {
      const low = word.toLocaleLowerCase(turLocale);
      const orig = originalCasingMap.get(low);
      if (orig && /[A-ZÇĞİÖŞÜ]/.test(orig)) return orig;
      if (orig && orig !== orig.toLocaleLowerCase(turLocale)) return orig;
      return word;
    }

    // Remove trailing verb-like tokens from candidate phrase
    function removeTrailingVerbLikeTokens(phrase: string) {
      if (!phrase) return phrase;
      let parts = phrase.split(/\s+/).map(p => p.replace(SAFE_TOKEN_RE, '')).filter(Boolean);
      while (parts.length > 0) {
        const last = parts[parts.length - 1].toLocaleLowerCase(turLocale);
        // exact match to common verbs or filler verb words
        if (COMMON_VERBS.has(last)) {
          parts.pop(); continue;
        }
        // ends with verb suffix hint
        let verbish = false;
        for (const suf of VERB_SUFFIXES) {
          if (last.endsWith(suf)) { verbish = true; break; }
        }
        if (verbish) { parts.pop(); continue; }
        // words like 'misin', 'misin', 'mi' etc
        if (/^(mi|mı|mu|mü|misin|mısın|miyiz|miydi|midir|misiniz)$/.test(last)) { parts.pop(); continue; }
        // small polite tokens
        if (/^(lütfen|lutfen|lgt)$/i.test(last)) { parts.pop(); continue; }
        break;
      }
      return parts.join(' ');
    }

    function pickKeywordsWindow(maxWords = 4) {
      const n = originalLower.length;
      if (n === 0) return null;
      const scores = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        const w = originalLower[i];
        if (STOPWORDS.has(w) || COMMON_VERBS.has(w)) { scores[i] = -100; continue; }
        for (const suf of VERB_SUFFIXES) { if (w.endsWith(suf)) { scores[i] -= 80; break; } }
        if (TIME_LOC.has(w)) scores[i] += 6;
        if (FINANCE.has(w)) scores[i] += 5;
        if (WEATHER.has(w)) scores[i] += 5;
        if (w.length >= 4) scores[i] += 2;
        if (/[A-ZÇĞİÖŞÜİ]/.test(originalTokensFull[i])) scores[i] += 3;
      }

      let best = { start: 0, len: Math.min(maxWords, n), score: -Infinity };
      for (let len = Math.min(maxWords, n); len >= 1; len--) {
        for (let s = 0; s + len <= n; s++) {
          let sum = 0;
          for (let k = 0; k < len; k++) sum += scores[s + k];
          for (let k = 0; k < len; k++) {
            const w = originalLower[s+k];
            if (TIME_LOC.has(w) || FINANCE.has(w) || WEATHER.has(w)) sum += 3;
          }
          if (sum > best.score) best = { start: s, len, score: sum };
        }
        if (best.score > 0) break;
      }

      if (best.score === -Infinity) return originalTokens.slice(0, maxWords).join(' ');
      const words = originalTokens.slice(best.start, best.start + best.len)
        .map(w => w.replace(SAFE_TOKEN_RE, ''))
        .filter(w => w && !STOPWORDS.has(w.toLocaleLowerCase(turLocale)));
      if (words.length === 0) return originalTokens.slice(0, Math.min(3, originalTokens.length)).join(' ');
      return words.join(' ');
    }

    function specialCases(rawLower: string[]): string | null {
      const lower = rawLower;
      const hasHisse = lower.includes('hisse') || lower.includes('hisseler');
      const hasKripto = lower.includes('kripto') || lower.includes('coin');
      const hasYatirim = lower.includes('yatırım') || lower.includes('yatir') || lower.includes('borsa');
      if ((hasHisse && hasKripto) || (hasYatirim && (hasKripto || hasHisse))) {
        return 'Yatırım tercihi: hisse mi kripto mu';
      }
      const hasWeather = lower.some(w => WEATHER.has(w));
      const city = lower.find(w => TIME_LOC.has(w) && ['istanbul','ankara','izmir','antalya'].includes(w));
      const timeToken = (lower.includes('geçen') ? 'Geçen hafta' : (lower.includes('yarın') ? 'Yarın' : (lower.includes('bugün') ? 'Bugün' : null)));
      if (hasWeather && city) {
        if (timeToken) return `${timeToken} ${capitalizeCity(city)}'da hava durumu`.trim();
        return `${capitalizeCity(city)}'da hava durumu`;
      }
      return null;
    }

    function capitalizeCity(c: string) {
      if (!c) return c;
      const low = c.toLocaleLowerCase(turLocale);
      return low.charAt(0).toLocaleUpperCase(turLocale) + low.slice(1);
    }

    function firstCap(s: string) {
      if (!s) return s;
      const low = s.toLocaleLowerCase(turLocale);
      return low.charAt(0).toLocaleUpperCase(turLocale) + low.slice(1);
    }

    // ---------- Model output extract & normalize ----------
    let titleRaw = (extractFromResponse(genJson) || '').trim();
    titleRaw = normalizeText(titleRaw).replace(/[.?!;:]+$/g, '').trim();
    console.log('generate-title -> extracted raw title:', titleRaw);

    function finalize(candidate: string | null): string {
      let cand = (candidate || '').trim();

      // Remove polite or filler prefixes
      cand = cand.replace(/^(bana|sence|lütfen|merhaba|selam)\s+/i, '');
      // Remove quoted marks and trailing punctuation
      cand = cand.replace(/(^["']|["']$)/g, '').trim();

      // Aggressively remove trailing verb-like tokens
      cand = removeTrailingVerbLikeTokens(cand);

      // split and filter
      let tokens = cand.split(/\s+/).map(t => t.replace(SAFE_TOKEN_RE, '')).filter(Boolean);
      // remove internal stopwords or very short junk tokens
      tokens = tokens.filter(t => {
        const low = t.toLocaleLowerCase(turLocale);
        if (STOPWORDS.has(low)) return false;
        if (COMMON_VERBS.has(low)) return false;
        return true;
      });

      let result = tokens.join(' ');

      // fallback: if nothing left or result is still verby, pick keywords from original
      if (!result || result.length < 2 || /^model$/i.test(result) || /^(düşünüyorum|düşünmek|düşünüyor|verebilir|vermek|söyle|söylemek)/i.test(result)) {
        result = pickKeywordsWindow(4) || originalTokens.slice(0,4).join(' ');
      }

      // after fallback, again ensure no trailing verbs
      result = removeTrailingVerbLikeTokens(result);

      // special-cases (finance, weather)
      const special = specialCases(originalLower);
      if (special) return special;

      // If original is question, ensure 'soru' appended appropriately (but avoid double verbs)
      const isQuestion = /\?|(^|\s)(mi|mı|mu|mü|mısın|misin|miyiz|miydiniz|miydi)\b/i.test(firstMessageRaw);
      if (isQuestion) {
        const rl = result.toLocaleLowerCase(turLocale);
        if (!rl.includes('soru') && !rl.includes('hakkında')) {
          const parts = result.split(/\s+/).filter(Boolean);
          if (parts.length === 1) result = `${parts[0]} hakkında soru`;
          else result = `${result} soru`;
        }
      }

      // limit length to 5 words
      let words = result.split(/\s+/).filter(Boolean).slice(0,5);

      // capitalization
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const preserved = preserveOriginal(w);
        if (i === 0) {
          if (preserved && preserved !== preserved.toLocaleLowerCase(turLocale)) words[i] = preserved;
          else words[i] = firstCap(w);
        } else {
          if (preserved && preserved !== preserved.toLocaleLowerCase(turLocale)) words[i] = preserved;
          else words[i] = w.toLocaleLowerCase(turLocale);
        }
      }

      let out = words.join(' ').replace(/\s+/g, ' ').trim();
      out = out.replace(/\b(hakkında hakkında)\b/g, 'hakkında');
      out = out.replace(/\b(soru soru)\b/g, 'soru');
      return out;
    }

    let candidateFromModel = titleRaw || null;
    let finalTitle = finalize(candidateFromModel);

    // if still ends with verbs or seems to echo full sentence, force fallback
    if (!finalTitle || finalTitle.split(/\s+/).length === 0 || /^[a-zığüşöçİĞÜŞÖÇ0-9\s]+ver/i.test(finalTitle)) {
      finalTitle = finalize(null);
    }

    // final guard: ensure first char uppercase
    if (finalTitle) {
      finalTitle = finalTitle.trim();
      finalTitle = finalTitle.charAt(0).toLocaleUpperCase(turLocale) + finalTitle.slice(1);
    }

    console.log('generate-title -> finalTitle:', finalTitle);

    return new Response(JSON.stringify({ title: finalTitle }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error("generate-title error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ message: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
