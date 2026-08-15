import type { Config, Context } from "@netlify/functions";

import { runAiChat, type ChatTurn } from "../../src/lib/ai-core";

/**
 * AI assistant endpoint for Netlify hosting.
 *
 * Provider keys stay in the store's admin settings; this function reads them
 * through a secured database function.
 *
 * Required Netlify environment variables:
 *  - SUPABASE_URL              : project URL
 *  - SUPABASE_PUBLISHABLE_KEY  : public (anon) key
 *  - AI_PROXY_SECRET           : same value saved in Admin → AI settings
 */
export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const secret = process.env["AI_PROXY_SECRET"];
  if (!supabaseUrl || !supabaseKey || !secret) {
    return Response.json({ error: "AI غير مهيأ على الاستضافة" }, { status: 500 });
  }

  let messages: ChatTurn[] = [];
  try {
    const body = (await request.json()) as { messages?: ChatTurn[] };
    messages = (body.messages ?? []).filter(
      (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    );
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!messages.length) return new Response("Invalid request", { status: 400 });

  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/get_ai_config`, {
      method: "POST",
      headers: { apikey: supabaseKey, "Content-Type": "application/json" },
      body: JSON.stringify({ _secret: secret }),
    });
    if (!res.ok) return Response.json({ error: "تعذر قراءة إعدادات الذكاء" }, { status: 502 });
    const config = (await res.json()) as Record<string, string>;

    const result = await runAiChat({
      config,
      messages: messages.slice(-30),
      supabaseUrl,
      supabaseKey,
      origin: new URL(request.url).origin,
    });
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "AI error" },
      { status: 502 },
    );
  }
};

export const config: Config = {
  path: "/api/public/ai/chat",
};
