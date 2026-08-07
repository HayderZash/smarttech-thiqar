import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const statusSchema = z.object({
  order_id: z.string().uuid(),
  status: z.enum(["review", "preparing", "shipped", "completed", "cancelled"]),
});

const couponSchema = z.object({
  code: z.string().trim().min(1).max(60),
  discount_type: z.enum(["fixed", "percent"]),
  discount_value: z.number().min(0),
  expires_at: z.string().trim().max(40).optional().nullable(),
});

const dealSchema = z.object({
  product_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  percent: z.number().int().min(1).max(99),
});

type Notif = { user_id: string; order_id?: string | null; title: string; body: string };

async function assertAdmin(context: {
  supabase: { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

/** Sends the same notification to every registered customer. */
async function broadcast(
  admin: { from: (t: string) => any },
  title: string,
  body: string,
): Promise<number> {
  const { data: users } = await admin.from("profiles").select("id");
  const rows: Notif[] = ((users ?? []) as { id: string }[]).map((u) => ({
    user_id: u.id,
    title,
    body,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    await admin.from("notifications").insert(rows.slice(i, i + 500));
  }
  return rows.length;
}

const STATUS_TEXT: Record<string, { title: string; body: (n: number) => string }> = {
  preparing: {
    title: "طلبك قيد التجهيز",
    body: (n) => `بدأنا بتجهيز طلبك رقم #${n}. سنعلمك عند تسليمه لمندوب التوصيل.`,
  },
  shipped: {
    title: "طلبك عند مندوب التوصيل",
    body: (n) => `طلبك رقم #${n} تم تسليمه لمندوب التوصيل وهو في الطريق إليك.`,
  },
  completed: {
    title: "تم إكمال طلبك",
    body: (n) => `تم تسليم طلبك رقم #${n} بنجاح. شكراً لثقتك بـ SmartTech.`,
  },
  cancelled: {
    title: "تم إلغاء الطلب",
    body: (n) => `تم إلغاء طلبك رقم #${n}. للاستفسار يمكنك التواصل معنا.`,
  },
  review: {
    title: "تم تحديث حالة طلبك",
    body: (n) => `طلبك رقم #${n} أصبح بحالة: جديد.`,
  },
};

/** Admin changes an order status and the customer gets a device notification. */
export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => statusSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.order_id)
      .select("id, order_number, customer_id, status")
      .single();
    if (error) throw new Error(error.message);

    const text = STATUS_TEXT[data.status];
    if (order?.customer_id && text) {
      await supabaseAdmin.from("notifications").insert({
        user_id: order.customer_id,
        order_id: order.id,
        title: text.title,
        body: text.body(Number(order.order_number)),
      });
    }
    return { ok: true as const };
  });

/** Admin creates a coupon; every customer is notified about the new code. */
export const createCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => couponSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const expires = data.expires_at ? new Date(data.expires_at).toISOString() : null;
    const code = data.code.toUpperCase();
    const { error } = await supabaseAdmin.from("coupons").insert({
      code,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      expires_at: expires,
      is_active: true,
    });
    if (error) throw new Error(error.message);

    const value =
      data.discount_type === "percent"
        ? `${data.discount_value}%`
        : `${Math.round(data.discount_value).toLocaleString("en-US")} د.ع`;
    const until = expires
      ? ` — صالح لغاية ${new Date(expires).toLocaleString("ar-IQ-u-nu-latn")}`
      : "";
    const sent = await broadcast(
      supabaseAdmin,
      "كود خصم جديد 🎁",
      `استخدم الكود ${code} واحصل على خصم ${value}${until}.`,
    );
    return { ok: true as const, sent };
  });

/** Admin announces a product discount to all customers. */
export const announceDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => dealSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sent = await broadcast(
      supabaseAdmin,
      "تخفيض جديد 🔥",
      `«${data.name}» صار عليه خصم ${data.percent}% — اطلبه الآن قبل نفاد الكمية.`,
    );
    return { ok: true as const, sent };
  });
