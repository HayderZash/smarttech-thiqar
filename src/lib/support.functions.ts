import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const messageSchema = z.object({ message: z.string().trim().min(2).max(2000) });

/** Sends a customer's support message and alerts every admin device. */
export const sendSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => messageSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", userId)
      .maybeSingle();

    const name = profile?.full_name || "زبون";
    const phone = profile?.phone || "";

    const { error } = await supabase.from("support_messages").insert({
      user_id: userId,
      sender_name: name,
      phone,
      message: data.message,
    });
    if (error) throw new Error(error.message);

    const { notifyAdmins } = await import("@/lib/notify.server");
    await notifyAdmins(
      "رسالة دعم جديدة 💬",
      `${name}${phone ? ` (${phone})` : ""}: ${data.message.slice(0, 160)}`,
    );

    return { ok: true as const };
  });
