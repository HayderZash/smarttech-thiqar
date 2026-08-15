import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { runAiChat, type ChatTurn } from "@/lib/ai-core";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(30),
});

/** Public AI assistant endpoint (also mirrored by a Netlify Function). */
export const Route = createFileRoute("/api/public/ai/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed: { messages: ChatTurn[] };
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return new Response("Invalid request", { status: 400 });
        }

        const supabaseUrl = process.env["SUPABASE_URL"];
        const supabaseKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !supabaseKey) return new Response("Not configured", { status: 500 });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: rows } = await supabaseAdmin.from("ai_settings").select("key, value");
          const config = Object.fromEntries(
            ((rows ?? []) as { key: string; value: string }[])
              .filter((r) => r.key !== "proxy_secret")
              .map((r) => [r.key, r.value]),
          );

          const result = await runAiChat({
            config,
            messages: parsed.messages,
            supabaseUrl,
            supabaseKey,
            origin: new URL(request.url).origin,
          });
          return Response.json(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : "AI error";
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
