// supabase/functions/ask-gemini/index.ts
import { corsHeaders } from '../_shared/cors.ts'

console.log("ask-gemini function cold start");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const SUPABASE_ANON_KEY = Deno.env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    const REQUIRE_AUTH = (Deno.env.get('REQUIRE_AUTH') || 'false').toLowerCase() === 'true';

    if (!GEMINI_API_KEY) throw new Error("FATAL: GEMINI_API_KEY is not set in Supabase secrets!");

    const authHeader = req.headers.get('authorization');
    const apikeyHeader = req.headers.get('apikey') || req.headers.get('x-api-key');

    if (REQUIRE_AUTH) {
      if (!authHeader && !apikeyHeader) throw new Error("Missing authorization header (REQUIRE_AUTH=true).");
      if (!authHeader && apikeyHeader && SUPABASE_ANON_KEY && apikeyHeader !== SUPABASE_ANON_KEY) throw new Error("Invalid apikey header.");
    } else {
      if (!authHeader && !apikeyHeader) console.warn("No Authorization/apikey header present. REQUIRE_AUTH=false.");
      else if (!authHeader && apikeyHeader && SUPABASE_ANON_KEY && apikeyHeader !== SUPABASE_ANON_KEY) console.warn("Provided apikey does not match SUPABASE_ANON_KEY (continuing).");
    }

    const jsonBody = await req.json().catch(() => null);
    if (!jsonBody || !Array.isArray(jsonBody.messages)) throw new Error("Request body must be JSON and include a 'messages' array.");
    const messages: any[] = jsonBody.messages;
    const lastMessage = String(messages[messages.length - 1]?.content ?? '');

    // LIST MODELS -> choose model
    async function pickModel(): Promise<string | null> {
      try {
        const listRes = await fetch("https://generativelanguage.googleapis.com/v1/models", {
          headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY }
        });
        const text = await listRes.text().catch(() => "");
        let parsed = null;
        try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
        const models = (parsed && (parsed.models || [])) || [];

        const preferredOrder = [
          "models/gemini-2.5-pro",
          "models/gemini-2.5-flash",
          "models/gemini-2.5-flash-lite",
          "models/gemini-2.0-flash"
        ];

        for (const pref of preferredOrder) {
          const found = models.find((m: any) => {
            const n = (m.name || "").toString();
            return n === pref || n.toLowerCase().includes(pref.replace("models/", ""));
          });
          if (found) {
            const methods = (found.supportedGenerationMethods || []).map(String).map(s => s.toLowerCase());
            if (methods.includes('generatecontent') || methods.includes('streamgeneratecontent')) {
              console.log("pickModel -> preferred:", found.name);
              return found.name;
            }
          }
        }

        for (const m of models) {
          const methods = (m.supportedGenerationMethods || []).map(String).map(s => s.toLowerCase());
          if (methods.includes('generatecontent') || methods.includes('streamgeneratecontent')) {
            console.log("pickModel -> fallback:", m.name);
            return m.name;
          }
        }

        console.warn("pickModel -> no suitable model found.");
        return null;
      } catch (err) {
        console.error("pickModel error:", err);
        return null;
      }
    }

    const chosenModel = await pickModel();
    if (!chosenModel) throw new Error("Uygun model bulunamadı (ListModels sonucu).");
    console.log("Chosen model:", chosenModel);

    // Normalize incoming roles -> Google expects 'user' or 'model'
    const contents = messages.map(m => {
      const incoming = String(m.role || '').toLowerCase();
      let roleForGoogle: 'user' | 'model' = 'user';
      if (incoming === 'user' || incoming === 'u') roleForGoogle = 'user';
      else roleForGoogle = 'model';
      return { role: roleForGoogle, parts: [{ text: String(m.content ?? '') }] };
    });

    // generation config
    const maxOutputTokens = Number(Deno.env.get('GEMINI_MAX_OUTPUT_TOKENS') || 1024);
    const temperature = Number(Deno.env.get('GEMINI_TEMPERATURE') || 0.3);
    const topP = Number(Deno.env.get('GEMINI_TOP_P') || 0.95);

    const genUrl = `https://generativelanguage.googleapis.com/v1/${chosenModel}:generateContent`;
    const genReqBody = { contents, generation_config: { maxOutputTokens, temperature, topP } };

    console.log("Calling generateContent (primary) ->", { genUrl, maxOutputTokens, temperature, topP });

    const genRes = await fetch(genUrl, {
      method: 'POST',
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify(genReqBody),
    });

    const genText = await genRes.text().catch(() => "");
    let genJson = null;
    try { genJson = JSON.parse(genText); } catch (e) { genJson = null; }

    if (!genRes.ok) {
      console.error("generateContent primary failed:", genRes.status, genRes.statusText, "bodyPreview:", (genText||"").slice(0,2000));
      const msg = genJson?.error?.message || genJson?.message || `Google API ${genRes.status} ${genRes.statusText}`;
      throw new Error(`Google generateContent failed: ${msg}`);
    }

    // robust extraction
    function findFirstStringInObject(obj: any): string | null {
      if (!obj) return null;
      if (typeof obj === 'string') return obj;
      if (Array.isArray(obj)) {
        for (const el of obj) {
          const f = findFirstStringInObject(el);
          if (f) return f;
        }
      } else if (typeof obj === 'object') {
        for (const k of Object.keys(obj)) {
          const f = findFirstStringInObject(obj[k]);
          if (f) return f;
        }
      }
      return null;
    }

    function extractTextFromGenerateResponse(resp: any): string {
      if (!resp) return "";
      // 1) candidates -> parts[].text
      if (Array.isArray(resp.candidates) && resp.candidates.length > 0) {
        for (const cand of resp.candidates) {
          if (cand?.content?.parts && Array.isArray(cand.content.parts)) {
            const parts = cand.content.parts.map((p: any) => (typeof p === 'string' ? p : (p?.text ?? ''))).join("");
            if (parts && parts.trim()) return parts;
          }
          if (cand?.outputText && typeof cand.outputText === 'string' && cand.outputText.trim()) return cand.outputText;
          if (typeof cand.content === 'string' && cand.content.trim()) return cand.content;
          if (cand?.content?.text && typeof cand.content.text === 'string' && cand.content.text.trim()) return cand.content.text;
          const found = findFirstStringInObject(cand.content);
          if (found && found.trim()) return found;
        }
      }

      // 2) renderedContent
      if (resp?.renderedContent && typeof resp.renderedContent === 'string' && resp.renderedContent.trim()) return resp.renderedContent;

      // 3) output array fallback
      if (Array.isArray(resp.output) && resp.output.length > 0) {
        for (const o of resp.output) {
          if (o?.content && Array.isArray(o.content)) {
            const joined = o.content.map((c: any) => (c?.text ?? "")).join("");
            if (joined && joined.trim()) return joined;
          }
        }
      }

      // 4) last resort
      const found = findFirstStringInObject(resp);
      return found ? found : "";
    }

    function isInvalidGeneratedText(t: string | null | undefined) {
      if (!t) return true;
      const s = String(t).trim();
      if (s.length < 3) return true; // çok kısa
      // salt roller ya da tek bir kelime "model" / "user" gibi ise geçersiz say
      const lower = s.toLowerCase();
      if (lower === 'model' || lower === 'user' || lower === 'assistant') return true;
      // genelde "{" veya "[" ile başlayan JSON(özellikle dev/debug) ise dön
      if (s.startsWith('{') && s.endsWith('}')) return true;
      return false;
    }

    let textOutput = extractTextFromGenerateResponse(genJson);
    if (isInvalidGeneratedText(textOutput)) {
      console.warn("Primary generateContent produced invalid/short output. Attempting fallback single-prompt generate with lastMessage. primaryPreview:", (textOutput||"").slice(0,200));
      // fallback: call generateContent again with a single prompt (last user message) - usually fixes 'role-only' return
      async function fallbackSinglePrompt(promptText: string) {
        if (!promptText || !promptText.trim()) return "";
        const fallbackBody = {
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generation_config: { maxOutputTokens: Math.max(1024, maxOutputTokens * 2), temperature: Math.max(0.4, temperature) }
        };
        try {
          console.log("Calling generateContent (fallback) with single prompt, bodyPreview:", (JSON.stringify(fallbackBody).slice(0,400)));
          const r = await fetch(genUrl, {
            method: 'POST',
            headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
            body: JSON.stringify(fallbackBody),
          });
          const t = await r.text().catch(() => "");
          let j = null;
          try { j = JSON.parse(t); } catch (e) { j = null; }
          if (!r.ok) {
            console.error("Fallback generateContent failed:", r.status, r.statusText, "bodyPreview:", (t||"").slice(0,2000));
            return "";
          }
          const out = extractTextFromGenerateResponse(j);
          return out || "";
        } catch (e) {
          console.error("Fallback generateContent exception:", e);
          return "";
        }
      }

      const fallbackText = await fallbackSinglePrompt(lastMessage);
      if (fallbackText && !isInvalidGeneratedText(fallbackText)) {
        textOutput = fallbackText;
        console.log("Fallback produced usable text (length):", textOutput.length);
      } else {
        console.warn("Fallback also failed or returned invalid output. primary:", (textOutput||"").slice(0,200), "fallback:", (fallbackText||"").slice(0,200));
        // final fallback: return stringify of genJson for debugging (but mark as error)
        throw new Error("Modelden okunabilir bir metin üretilemedi (hem primary hem fallback başarısız).");
      }
    }

    // Return as text/plain stream
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(textOutput));
        controller.close();
      }
    });

    return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }, status: 200 });

  } catch (err) {
    console.error("!!! Critical error in ask-gemini function:", err);
    const msg = (err instanceof Error) ? err.message : String(err);
    return new Response(JSON.stringify({ message: msg }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
