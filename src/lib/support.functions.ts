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

const replySchema = z.object({
  id: z.string().uuid(),
  reply: z.string().trim().min(1).max(2000),
});

/** Admin replies to a support message inside the app and notifies the customer. */
export const replySupportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => replySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("support_messages")
      .update({ admin_reply: data.reply, replied_at: new Date().toISOString(), is_read: true })
      .eq("id", data.id)
      .select("user_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("الرسالة غير موجودة");

    await supabaseAdmin.from("notifications").insert({
      user_id: row.user_id,
      title: "رد من إدارة المتجر 💬",
      body: data.reply.slice(0, 300),
    });

    return { ok: true as const };
  });
