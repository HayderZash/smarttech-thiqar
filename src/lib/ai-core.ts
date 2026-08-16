/**
 * Host-independent AI assistant core.
 *
 * Pure `fetch` code (no Supabase SDK, no server-only imports) so the exact same
 * logic can run inside a TanStack server route (Lovable hosting) and inside a
 * Netlify Function.
 */
import { applyPricing, parsePriceTiers } from "./format";

export type AiConfig = Record<string, string>;

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type AiProduct = {
  id: string;
  name: string;
  sku: string;
  price: number;
  image_url: string | null;
  stock_qty: number;
  url: string;
};

export type AiReply = { reply: string; products: AiProduct[] };

const REST = (url: string, path: string) => `${url.replace(/\/$/, "")}/rest/v1/${path}`;

async function rest<T>(url: string, key: string, path: string): Promise<T> {
  const res = await fetch(REST(url, path), {
    headers: { apikey: key, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`db ${res.status}`);
  return (await res.json()) as T;
}

/** Strips noise so the words can be used in an ILIKE search. */
function keywords(text: string): string[] {
  return text
    .replace(/[^\p{L}\p{N}\s.]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
    .slice(0, 6);
}

/** Finds the products that best match what the customer asked about. */
export async function searchProducts(
  supabaseUrl: string,
  supabaseKey: string,
  query: string,
  origin: string,
  limit = 6,
): Promise<AiProduct[]> {
  const words = keywords(query);
  if (!words.length) return [];

  const settings = await rest<{ key: string; value: string }[]>(
    supabaseUrl,
    supabaseKey,
    `store_settings?select=key,value&key=in.(price_tiers,price_markup_percent)`,
  ).catch(() => []);
  const map = Object.fromEntries(settings.map((r) => [r.key, r.value]));
  const tiers = parsePriceTiers(map["price_tiers"], Number(map["price_markup_percent"] ?? 0) || 0);

  const seen = new Map<string, AiProduct>();
  for (const word of words) {
    const enc = encodeURIComponent(`%${word}%`);
    const or = `or=(name_ar.ilike.${enc},name_en.ilike.${enc},sku.ilike.${enc},description_ar.ilike.${enc},description_en.ilike.${enc})`;
    const rows = await rest<
      {
        id: string;
        sku: string;
        name_ar: string;
        name_en: string;
        price: number;
        discount_price: number | null;
        image_url: string | null;
        stock_qty: number;
      }[]
    >(
      supabaseUrl,
      supabaseKey,
      `products?select=id,sku,name_ar,name_en,price,discount_price,image_url,stock_qty&${or}&limit=${limit}`,
    ).catch(() => []);

    for (const p of rows) {
      if (seen.has(p.id)) continue;
      const dp = Number(p.discount_price ?? 0);
      const base = dp > 0 && dp < Number(p.price) ? dp : Number(p.price);
      seen.set(p.id, {
        id: p.id,
        sku: p.sku,
        name: p.name_ar || p.name_en,
        price: applyPricing(base, tiers),
        image_url: p.image_url,
        stock_qty: Number(p.stock_qty ?? 0),
        url: `${origin.replace(/\/$/, "")}/product/${p.id}`,
      });
    }
    if (seen.size >= limit) break;
  }
  return [...seen.values()].slice(0, limit);
}

const OPENAI_COMPATIBLE: Record<string, { base: string; model: string; keyName: string }> = {
  groq: {
    base: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    keyName: "api_key_groq",
  },
  openrouter: {
    base: "https://openrouter.ai/api/v1/chat/completions",
    model: "google/gemini-2.5-flash",
    keyName: "api_key_openrouter",
  },
  siliconflow: {
    base: "https://api.siliconflow.cn/v1/chat/completions",
    model: "Qwen/Qwen2.5-72B-Instruct",
    keyName: "api_key_siliconflow",
  },
  mistral: {
    base: "https://api.mistral.ai/v1/chat/completions",
    model: "mistral-large-latest",
    keyName: "api_key_mistral",
  },
};

function systemPrompt(products: AiProduct[], extra: string): string {
  const catalog = products.length
    ? products
        .map(
          (p) =>
            `- ${p.name} | SKU ${p.sku} | ${Math.round(p.price).toLocaleString("en-US")} د.ع | ${
              p.stock_qty > 0 ? "متوفر" : "غير متوفر"
            }`,
        )
        .join("\n")
    : "لا توجد نتائج مطابقة في المخزن لهذا السؤال.";

  return [
    "أنت مساعد مبيعات ذكي لمتجر SmartTech العراقي (إلكترونيات، كهربائيات، طاقة شمسية، مواد إنشائية).",
    "أجب بالعربية بإيجاز ووضوح، واذكر الأسعار بالدينار العراقي.",
    "اعتمد فقط على المنتجات المذكورة أدناه ولا تخترع منتجات أو أسعاراً.",
    "لا تكتب أي روابط أو عناوين URL إطلاقاً — اذكر اسم المنتج والسعر فقط، فبطاقات المنتجات تُعرض تلقائياً للزبون.",
    "إذا لم تجد المنتج المطلوب اطلب من الزبون توضيح المواصفات (الفولتية، الأمبير، الحجم...).",
    extra.trim(),
    "",
    "منتجات من قاعدة بيانات المتجر:",
    catalog,
  ]
    .filter(Boolean)
    .join("\n");
}


async function callGemini(
  key: string,
  model: string,
  system: string,
  turns: ChatTurn[],
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: turns.map((t) => ({
          role: t.role === "assistant" ? "model" : "user",
          parts: [{ text: t.content }],
        })),
      }),
    },
  );
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? `gemini ${res.status}`);
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

async function callOpenAiCompatible(
  base: string,
  key: string,
  model: string,
  system: string,
  turns: ChatTurn[],
): Promise<string> {
  const res = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...turns],
      temperature: 0.3,
    }),
  });
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? `ai ${res.status}`);
  return json.choices?.[0]?.message?.content ?? "";
}

/** Answers a customer question with store context and matching product cards. */
export async function runAiChat(options: {
  config: AiConfig;
  messages: ChatTurn[];
  supabaseUrl: string;
  supabaseKey: string;
  origin: string;
}): Promise<AiReply> {
  const { config, messages, supabaseUrl, supabaseKey, origin } = options;
  const provider = (config["provider"] || "gemini").toLowerCase();
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const products = await searchProducts(supabaseUrl, supabaseKey, lastUser, origin);
  const system = systemPrompt(products, config["system_prompt"] ?? "");
  const turns = messages.slice(-12);

  let reply = "";
  if (provider === "gemini") {
    const key = config["api_key_gemini"];
    if (!key) throw new Error("مفتاح Gemini غير مضبوط في إعدادات الإدارة");
    reply = await callGemini(key, config["model"] || "gemini-2.5-flash", system, turns);
  } else {
    const spec = OPENAI_COMPATIBLE[provider];
    if (!spec) throw new Error("مزود ذكاء اصطناعي غير مدعوم");
    const key = config[spec.keyName];
    if (!key) throw new Error("مفتاح المزود غير مضبوط في إعدادات الإدارة");
    reply = await callOpenAiCompatible(
      spec.base,
      key,
      config["model"] || spec.model,
      system,
      turns,
    );
  }

  return { reply: reply.trim() || "لم أتمكن من إيجاد إجابة، جرّب صياغة أخرى.", products };
}
