import { Ai } from "@cloudflare/ai";

type ModelName = Parameters<Ai["run"]>[0];

export interface Env {
  AI: any; // Workers AI binding
  RL: KVNamespace;

  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;

  ALLOWED_ORIGIN: string; // örn: http://localhost:3000 veya "http://localhost:3000,https://domain.com"
  MAX_REQ_PER_DAY: string; // örn: "40"
  MODEL: string; // örn: "@cf/meta/llama-3.1-8b-instruct-fast"
}

type IncomingMessage = { role: "user" | "model" | "assistant" | "system"; content: string };

function corsHeaders(corsOrigin: string) {
  return {
    "Access-Control-Allow-Origin": corsOrigin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function yyyyMMddUTC() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

async function getSupabaseUserId(env: Env, accessToken: string): Promise<string | null> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { id?: string };
  return data?.id ?? null;
}

async function checkAndIncrementDailyLimit(env: Env, userId: string) {
  const key = `rl:${userId}:${yyyyMMddUTC()}`;
  const max = Math.max(1, parseInt(env.MAX_REQ_PER_DAY || "40", 10));

  const currentRaw = await env.RL.get(key);
  const current = currentRaw ? parseInt(currentRaw, 10) : 0;

  if (current >= max) {
    return { ok: false as const, remaining: 0, max };
  }

  const next = current + 1;
  await env.RL.put(key, String(next), { expirationTtl: 60 * 60 * 24 * 2 }); // 2 gün

  return { ok: true as const, remaining: max - next, max };
}

function normalizeMessages(messages: IncomingMessage[]) {
  // app’te "model" geliyor → Workers AI tarafında "assistant" olmalı
  return messages
    .filter((m) => m && typeof m.content === "string")
    .map((m) => ({
      role: m.role === "model" ? "assistant" : m.role,
      content: String(m.content ?? ""),
    }));
}

function lastUserText(messages: Array<{ role: string; content: string }>) {
  return [...messages].reverse().find((m) => m.role === "user")?.content?.trim() ?? "";
}

function cleanTitle(title: string) {
  return title
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/**
 * 1-5 kelime zorlaması: model bazen uzun cümle döndürse bile kırpıyoruz.
 * (Başlığın AI tarafından seçilmesi için önce AI üretir, sonra formatı enforce ederiz.)
 */
function enforce1to5Words(title: string) {
  const cleaned = cleanTitle(title);
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words[0] || "Yeni Sohbet";
  return words.slice(0, 5).join(" ");
}

function pickTextFromResult(result: any) {
  return (
    (typeof result?.response === "string" && result.response) ||
    (typeof result?.result === "string" && result.result) ||
    (typeof result === "string" && result) ||
    ""
  );
}

async function generateTitle(ai: Ai, model: ModelName, userPrompt: string) {
  const titleSystem = [
    "Sen bir başlık üretim aracısın.",
    "Kullanıcının metnini analiz et ve 1-5 kelimelik başlık üret.",
    "",
    "KURAL:",
    "Sadece başlığı yaz. Başka hiçbir şey yazma.",
    "Emoji kullanma. Tırnak kullanma.",
    "",
    "Şu soruyu cevaplıyormuş gibi düşün:",
    '"Sadece cevapları vermeni istiyorum. (kullanıcının promptu buraya gelecek) yazısına, bu yazıyı ifade eden özet geçen ama başlık tarzında olan, birkaç kelimelik (minimum 1 maksimum 5 kelime) özet bir başlık ayarlamak isteseydin bu ne olurdu?"',
  ].join("\n");

  const r: any = await ai.run(model, {
    messages: [
      { role: "system", content: titleSystem },
      { role: "user", content: userPrompt },
    ],
    // başlık için küçük tut
    max_tokens: 32,
  });

  const raw = pickTextFromResult(r);
  return enforce1to5Words(raw);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") || "";
    const allowedList = (env.ALLOWED_ORIGIN || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // origin boşsa (curl vs) izin ver
    const isAllowed = !allowedList.length || !origin || allowedList.includes(origin);

    if (!isAllowed) {
      return new Response("Forbidden (bad origin)", { status: 403 });
    }

    // CORS için: izin verilen origin neyse onu geri dön
    const corsOrigin = origin && allowedList.includes(origin) ? origin : allowedList[0] ?? "";

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(corsOrigin) });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders(corsOrigin) });
    }

    // Auth: Supabase access token
    const auth = request.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders(corsOrigin) });
    }

    // ✅ 1) token doğrula
    const userId = await getSupabaseUserId(env, token);
    if (!userId) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders(corsOrigin) });
    }

    // ✅ 2) kota kontrol et (AI çağrısından önce)
    const limit = await checkAndIncrementDailyLimit(env, userId);
    if (!limit.ok) {
      return new Response(
        JSON.stringify({
          error: "DAILY_LIMIT",
          message: "Günlük limit aşıldı. Yarın tekrar deneyin.",
          maxPerDay: limit.max,
        }),
        {
          status: 429,
          headers: { ...corsHeaders(corsOrigin), "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    // Body parse
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response("Bad Request (invalid JSON)", { status: 400, headers: corsHeaders(corsOrigin) });
    }

    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response("Bad Request (messages required)", { status: 400, headers: corsHeaders(corsOrigin) });
    }

    const model = (env.MODEL || "@cf/meta/llama-3.1-8b-instruct-fast") as ModelName;
    const ai = new Ai(env.AI);

    const normalized = normalizeMessages(messages);
    const userPrompt = lastUserText(normalized);

    // İstersen client'tan kontrol edebilirsin: body.generateTitle === true
    // Şimdilik her response ile title döndürüyoruz.
    const baseSystem = "Sen Türkçe konuşan yardımcı bir sohbet asistanısın.";

    try {
      // 1) CEVAP
      const answerResult: any = await ai.run(model, {
        messages: [{ role: "system", content: baseSystem }, ...normalized],
        max_tokens: 1024,
      });
      const answerText = pickTextFromResult(answerResult);

      // 2) BAŞLIK (sadece son user prompt ile)
      const title = userPrompt.length > 0 ? await generateTitle(ai, model, userPrompt) : "Yeni Sohbet";

      // ✅ Backward compatible alanlar:
      // - response: eski frontend’in data.response beklediği yer
      // - answer: yeni alan
      return new Response(
        JSON.stringify({
          response: answerText,
          answer: answerText,
          title,
          remainingToday: limit.remaining,
          maxPerDay: limit.max,
        }),
        {
          status: 200,
          headers: { ...corsHeaders(corsOrigin), "Content-Type": "application/json; charset=utf-8" },
        }
      );
    } catch {
      return new Response(
        JSON.stringify({ error: "AI_ERROR", message: "Model çağrısı başarısız." }),
        {
          status: 500,
          headers: { ...corsHeaders(corsOrigin), "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }
  },
};