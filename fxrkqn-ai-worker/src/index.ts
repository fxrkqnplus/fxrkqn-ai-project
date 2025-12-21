type WorkersAI = {
  run: (model: string, input: unknown) => Promise<unknown>;
};

type ModelName = Parameters<WorkersAI["run"]>[0];
export interface Env {
  AI: WorkersAI; // Workers AI binding
  RL: KVNamespace;

  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;

  ALLOWED_ORIGIN: string; // örn: http://localhost:3000 veya "http://localhost:3000,https://domain.com"
  MAX_REQ_PER_DAY: string; // örn: "40"
  /**
   * Varsayılan model (geriye dönük uyumlu).
   * Eğer MODEL_FAST / MODEL_THINK tanımlı değilse fallback olarak kullanılır.
   */
  MODEL: string; // örn: "@cf/meta/llama-3.1-8b-instruct-fast"

  /** Hızlı mod modeli (daha düşük gecikme / daha düşük maliyet hedefi). */
  MODEL_FAST?: string; // örn: "@cf/ibm-granite/granite-4.0-h-micro"

  /** Düşünür mod modeli (daha yüksek kalite / hafıza destekli). */
  MODEL_THINK?: string; // örn: "@cf/meta/llama-3.1-8b-instruct-fast"

  /** Hafıza güncelleme modeli (mümkün olduğunca ucuz tut). */
  MODEL_MEMORY?: string; // örn: "@cf/ibm-granite/granite-4.0-h-micro"
}

type IncomingMessage = { role: "user" | "model" | "assistant" | "system"; content: string };

type ChatMode = "fast" | "think";

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

function draftTitleFromPrompt(text: string) {
  const cleaned = (text || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[“”"']/g, "")
    .trim();
  const title = cleaned.split(/\s+/).slice(0, 5).join(" ").trim();
  return title || "Yeni Sohbet";
}

function pickTextFromResult(result: any) {
  return (
    (typeof result?.response === "string" && result.response) ||
    (typeof result?.result === "string" && result.result) ||
    (typeof result === "string" && result) ||
    ""
  );
}

function parseMode(value: unknown): ChatMode {
  return value === "think" ? "think" : "fast";
}

function pickMaxTokensForMode(mode: ChatMode) {
  // 
  // ⚠️ Not: Bazı modeller (özellikle daha küçük/ucuz olanlar) yüksek max_tokens
  // değerlerinde hata döndürebiliyor. Hızlı modda default'u düşük tutarak
  // hem maliyeti düşürüyor hem de uyumluluğu artırıyoruz.
  //
  return mode === "think" ? 1024 : 256;
}

function pickModelForMode(env: Env, mode: ChatMode): ModelName {
  const fallback = (env.MODEL || "@cf/ibm-granite/granite-4.0-h-micro") as ModelName;

  if (mode === "think") {
    return ((env.MODEL_THINK || env.MODEL) as ModelName) || fallback;
  }

  return ((env.MODEL_FAST || env.MODEL) as ModelName) || fallback;
}

function pickMemoryModel(env: Env): ModelName {
  return ((env.MODEL_MEMORY || env.MODEL_FAST || env.MODEL) as ModelName) || ("@cf/ibm-granite/granite-4.0-h-micro" as ModelName);
}

function buildBaseSystem(mode: ChatMode, memorySummary: string | null) {
  const base = [
    "Sen Türkçe konuşan yardımcı bir sohbet asistanısın.",
    "Kısa, net ve doğru cevap ver.",
    "Gereksiz uzatma ve tahmin yürütme; emin değilsen bunu açıkça söyle.",
  ];

  if (mode === "think") {
    base.push(
      "Zor sorularda daha dikkatli düşün, gerekirse çözümü adım adım planla.",
      "İç düşünceni uzatmadan, kullanıcıya sadece gerekli kısmı aktar."
    );
  } else {
    base.push("Hızlı moddasın: mümkün olduğunca kısa ve pratik yanıt ver.");
  }

  if (mode === "think" && memorySummary && memorySummary.trim()) {
    base.push(
      "",
      "KALICI HAFIZA (özet):",
      memorySummary.trim(),
      "",
      "Bu hafızayı kullanarak daha tutarlı yanıt ver. Hafızadaki kesin olmayan bilgileri gerçek gibi sunma.",
    );
  }

  return base.join("\n");
}

function cleanMemory(text: string) {
  return text.replace(/\s+$/g, "").trim().slice(0, 2000);
}

async function updateMemorySummary(
  ai: WorkersAI,
  model: ModelName,
  prevMemory: string | null,
  userText: string,
  assistantText: string
) {
  const sys = [
    "Sen bir 'hafıza güncelleme' aracısın.",
    "Amaç: Kullanıcıyla yapılan konuşmadan uzun vadede işe yarayan bilgileri kısa bir özet hafızaya yazmak.",
    "Sadece KALICI ve işe yarar bilgileri ekle: kullanıcının hedefleri, tercihleri, projeler, kararlar, isimler, yapılacaklar.",
    "Kesin olmayan varsayımları ekleme.",
    "Çıktı Türkçe olmalı.",
    "Format: 6-12 kısa madde (• ile).",
    "Aynı bilgiyi tekrar etme. Gereksiz sohbeti yazma.",
    "Sadece hafızayı yaz; başka açıklama yazma.",
  ].join("\n");

  const user = [
    "Önceki hafıza:",
    prevMemory?.trim() ? prevMemory.trim() : "(yok)",
    "",
    "Yeni konuşma parçası:",
    `Kullanıcı: ${userText}`,
    `Asistan: ${assistantText}`,
    "",
    "Yeni hafızayı üret.",
  ].join("\n");

  const r: any = await ai.run(model, {
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    max_tokens: 256,
  });

  const raw = pickTextFromResult(r);
  return cleanMemory(raw);
}

async function generateTitle(ai: WorkersAI, model: ModelName, userPrompt: string) {
  const titleSystem = [
    "Sen bir başlık üretim aracısın.",
    "Görev: Kullanıcının mesajını 1-5 kelimelik bir sohbet başlığına dönüştür.",
    "",
    "KURALLAR:",
    "- Türkçe yaz.",
    "- Sadece başlığı yaz; başka hiçbir şey yazma.",
    "- 1 ile 5 kelime arasında olmalı.",
    "- Emoji, tırnak ve noktalama işaretlerini mümkün olduğunca kullanma.",
    "- Genel/geçersiz başlıklar üretme (ör. 'Yeni Sohbet').",
  ].join("\n");

  const r: any = await ai.run(model, {
    messages: [
      { role: "system", content: titleSystem },
      { role: "user", content: userPrompt },
    ],
    // başlık için küçük tut
    max_tokens: 32,
    // daha deterministik olsun
    temperature: 0.2,
  });

  const raw = pickTextFromResult(r);
  const candidate = enforce1to5Words(raw);
  // Model bazen boş/uygunsuz bir şey döndürürse prompttan türet.
  if (!candidate || candidate.trim().toLowerCase() === "yeni sohbet") {
    return draftTitleFromPrompt(userPrompt);
  }
  return candidate;
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

    const ai = env.AI;

    const mode = parseMode(body?.mode);
    const memorySummary = typeof body?.memory === "string" ? body.memory : null;
    const generateTitleFlag = body?.generateTitle === true;
    const updateMemoryFlag = body?.updateMemory === true;

    const model = pickModelForMode(env, mode);
    const memoryModel = pickMemoryModel(env);

    const normalized = normalizeMessages(messages);
    const userPrompt = lastUserText(normalized);

    const baseSystem = buildBaseSystem(mode, memorySummary);

    // Basit fallback zinciri: seçili model hata verirse başka bir modele düş.
    // Hedef: "fast" modda asla tamamen boşa düşmemek.
    const fallbackCandidates: ModelName[] = [];
    const addCandidate = (m?: string) => {
      const mm = (m || "").trim();
      if (mm) fallbackCandidates.push(mm as ModelName);
    };
    // 1) env.MODEL (genel fallback)
    addCandidate(env.MODEL);
    // 2) env.MODEL_THINK (genelde daha stabil ama daha pahalı olabilir)
    addCandidate(env.MODEL_THINK);
    // 3) her ihtimale karşı küçük/ucuz bir model
    addCandidate("@cf/meta/llama-3.2-1b-instruct");

    async function runWithModel(chosen: ModelName) {
      const answerResult: any = await ai.run(chosen, {
        messages: [{ role: "system", content: baseSystem }, ...normalized],
        max_tokens: pickMaxTokensForMode(mode),
      });
      const answerText = pickTextFromResult(answerResult);
      return { answerText, answerResult };
    }

    try {
      // 1) CEVAP
      let usedModel: ModelName = model;
      let answerText = "";
      let answerResult: any = null;

      try {
        const r = await runWithModel(model);
        answerText = r.answerText;
        answerResult = r.answerResult;
      } catch (err) {
        if (mode !== "fast") throw err;

        // fast modda: fallback adaylarını sırayla dene (seçili model hariç)
        let lastErr: unknown = err;
        for (const cand of fallbackCandidates) {
          if (!cand || cand === model) continue;
          try {
            usedModel = cand;
            const r2 = await runWithModel(cand);
            answerText = r2.answerText;
            answerResult = r2.answerResult;
            lastErr = null;
            break;
          } catch (e) {
            lastErr = e;
          }
        }

        if (lastErr) throw lastErr;
      }

      if (mode === "fast" && (!answerText || !answerText.trim())) {
        // Nadiren boş cevap dönebiliyor; fast modda fallback adaylarını bir daha dene.
        for (const cand of fallbackCandidates) {
          if (!cand || cand === usedModel) continue;
          try {
            usedModel = cand;
            const r3 = await runWithModel(cand);
            answerText = r3.answerText;
            answerResult = r3.answerResult;
            if (answerText && answerText.trim()) break;
          } catch {
            // ignore
          }
        }
      }

      // 2) BAŞLIK (sadece istenirse) -> Cevabı üreten modelle üret (daha tutarlı olur)
      let title: string | null = null;
      if (generateTitleFlag && userPrompt.length > 0) {
        try {
          title = await generateTitle(ai, usedModel, userPrompt);
        } catch {
          title = null;
        }
      }

      // 3) HAFIZA (sadece "think" modunda ve istenirse) -> hata olursa cevabı bozma
      let nextMemory: string | null = null;
      if (mode === "think" && updateMemoryFlag && userPrompt) {
        try {
          nextMemory = await updateMemorySummary(ai, memoryModel, memorySummary, userPrompt, answerText);
        } catch {
          nextMemory = null;
        }
      }

      // ✅ Backward compatible alanlar:
      // - response: eski frontend’in data.response beklediği yer
      // - answer: yeni alan
      return new Response(
        JSON.stringify({
          response: answerText,
          answer: answerText,
          title,
          mode,
          modelUsed: usedModel,
          memory: nextMemory,
          remainingToday: limit.remaining,
          maxPerDay: limit.max,
        }),
        {
          status: 200,
          headers: { ...corsHeaders(corsOrigin), "Content-Type": "application/json; charset=utf-8" },
        }
      );
    } catch (err: any) {
      const details = typeof err?.message === "string" ? err.message : String(err ?? "");
      return new Response(
        JSON.stringify({ error: "AI_ERROR", message: "Model çağrısı başarısız.", details }),
        {
          status: 500,
          headers: { ...corsHeaders(corsOrigin), "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }
  },
};