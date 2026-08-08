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

/** Admin-only profit report for one order: base cost vs. sold price per line. */
export const orderProfit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: items, error } = await supabaseAdmin
      .from("order_items")
      .select("id, product_id, product_name, quantity, unit_price, is_unavailable")
      .eq("order_id", data.order_id);
    if (error) throw new Error(error.message);

    const ids = (items ?? []).map((i) => i.product_id).filter(Boolean) as string[];
    const { data: products } = ids.length
      ? await supabaseAdmin.from("products").select("id, price, discount_price").in("id", ids)
      : { data: [] as { id: string; price: number; discount_price: number | null }[] };
    const baseOf = new Map(
      ((products ?? []) as { id: string; price: number; discount_price: number | null }[]).map((p) => {
        const dp = p.discount_price == null ? 0 : Number(p.discount_price);
        const price = Number(p.price) || 0;
        return [p.id, dp > 0 && dp < price ? dp : price] as const;
      }),
    );

    const lines = (items ?? [])
      .filter((i) => !i.is_unavailable)
      .map((i) => {
        const qty = Number(i.quantity) || 0;
        const sell = Number(i.unit_price) || 0;
        const base = baseOf.get(String(i.product_id)) ?? 0;
        const profitUnit = sell - base;
        return {
          id: String(i.id),
          name: String(i.product_name),
          quantity: qty,
          base_price: base,
          sell_price: sell,
          profit_unit: profitUnit,
          profit_total: profitUnit * qty,
          percent: base > 0 ? Math.round((profitUnit / base) * 1000) / 10 : 0,
          known: base > 0,
        };
      });

    const totalBase = lines.reduce((s, l) => s + l.base_price * l.quantity, 0);
    const totalSell = lines.reduce((s, l) => s + l.sell_price * l.quantity, 0);
    const totalProfit = totalSell - totalBase;
    return {
      lines,
      total_base: totalBase,
      total_sell: totalSell,
      total_profit: totalProfit,
      percent: totalBase > 0 ? Math.round((totalProfit / totalBase) * 1000) / 10 : 0,
    };
  });

/** Admin-only profit report for many orders at once (for the Excel export). */
export const ordersProfit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ order_ids: z.array(z.string().uuid()).min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: orders, error: oErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, customer_name, phone, status, created_at, total_amount")
      .in("id", data.order_ids);
    if (oErr) throw new Error(oErr.message);

    const { data: items, error } = await supabaseAdmin
      .from("order_items")
      .select("id, order_id, product_id, product_name, quantity, unit_price, is_unavailable")
      .in("order_id", data.order_ids);
    if (error) throw new Error(error.message);

    const ids = (items ?? []).map((i) => i.product_id).filter(Boolean) as string[];
    const { data: products } = ids.length
      ? await supabaseAdmin.from("products").select("id, price, discount_price").in("id", ids)
      : { data: [] as { id: string; price: number; discount_price: number | null }[] };
    const baseOf = new Map(
      ((products ?? []) as { id: string; price: number; discount_price: number | null }[]).map(
        (p) => {
          const dp = p.discount_price == null ? 0 : Number(p.discount_price);
          const price = Number(p.price) || 0;
          return [p.id, dp > 0 && dp < price ? dp : price] as const;
        },
      ),
    );

    return ((orders ?? []) as Record<string, any>[]).map((o) => {
      const lines = (items ?? [])
        .filter((i) => i.order_id === o["id"] && !i.is_unavailable)
        .map((i) => {
          const qty = Number(i.quantity) || 0;
          const sell = Number(i.unit_price) || 0;
          const base = baseOf.get(String(i.product_id)) ?? 0;
          return {
            name: String(i.product_name),
            quantity: qty,
            base_price: base,
            sell_price: sell,
            profit_total: (sell - base) * qty,
            known: base > 0,
          };
        });
      const total_base = lines.reduce((s, l) => s + l.base_price * l.quantity, 0);
      const total_sell = lines.reduce((s, l) => s + l.sell_price * l.quantity, 0);
      const total_profit = total_sell - total_base;
      return {
        order_id: String(o["id"]),
        order_number: Number(o["order_number"]),
        customer_name: String(o["customer_name"] ?? ""),
        phone: String(o["phone"] ?? ""),
        status: String(o["status"]),
        created_at: String(o["created_at"]),
        total_amount: Number(o["total_amount"] ?? 0),
        lines,
        total_base,
        total_sell,
        total_profit,
        percent: total_base > 0 ? Math.round((total_profit / total_base) * 1000) / 10 : 0,
      };
    });
  });

/** Notifies every customer who asked to be alerted when a product is back in stock. */
export const notifyRestock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ product_id: z.string().uuid(), name: z.string().trim().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: alerts } = await supabaseAdmin
      .from("stock_alerts")
      .select("id, phone")
      .eq("product_id", data.product_id)
      .eq("is_notified", false);
    if (!alerts?.length) return { ok: true as const, sent: 0 };

    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, phone");
    const tail = (p: string) => p.replace(/\D/g, "").slice(-9);
    const byTail = new Map<string, string>();
    for (const p of (profiles ?? []) as { id: string; phone: string }[]) {
      if (p.phone) byTail.set(tail(p.phone), p.id);
    }

    const rows: Notif[] = [];
    for (const a of alerts as { id: string; phone: string }[]) {
      const uid = byTail.get(tail(a.phone));
      if (uid) {
        rows.push({
          user_id: uid,
          title: "المنتج صار متوفر ✅",
          body: `«${data.name}» رجع متوفر بالمخزن — اطلبه الآن قبل نفاد الكمية.`,
        });
      }
    }
    if (rows.length) await supabaseAdmin.from("notifications").insert(rows);
    await supabaseAdmin
      .from("stock_alerts")
      .update({ is_notified: true })
      .in("id", (alerts as { id: string }[]).map((a) => a.id));

    return { ok: true as const, sent: rows.length };
  });
