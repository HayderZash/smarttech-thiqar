import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Inserts the same notification for every admin account. */
export async function notifyAdmins(title: string, body: string, orderId?: string): Promise<number> {
  const { data: admins } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  const ids = [...new Set(((admins ?? []) as { user_id: string }[]).map((a) => a.user_id))];
  if (!ids.length) return 0;
  await supabaseAdmin
    .from("notifications")
    .insert(ids.map((id) => ({ user_id: id, order_id: orderId ?? null, title, body })));
  return ids.length;
}
