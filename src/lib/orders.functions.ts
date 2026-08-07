import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const placeOrderSchema = z.object({
  items: z
    .array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().min(1).max(999) }))
    .min(1)
    .max(100),
  governorate_id: z.string().uuid(),
  landmark: z.string().trim().min(2).max(300),
  preferred_delivery_time: z.string().trim().max(120).default(""),
  coupon_code: z.string().trim().max(60).optional().nullable(),
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(20),
});

const couponSchema = z.object({ code: z.string().trim().min(1).max(60), subtotal: z.number().min(0) });

function computeDiscount(
  coupon: { discount_type: string; discount_value: number } | null,
  subtotal: number,
) {
  if (!coupon) return 0;
  const raw =
    coupon.discount_type === "percent"
      ? (subtotal * Number(coupon.discount_value)) / 100
      : Number(coupon.discount_value);
  return Math.max(0, Math.min(subtotal, Math.round(raw)));
}

export const validateCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => couponSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: coupon } = await supabase
      .from("coupons")
      .select("code, discount_type, discount_value, is_active")
      .eq("code", data.code.toUpperCase())
      .eq("is_active", true)
      .maybeSingle();
    if (!coupon) return { valid: false as const, discount: 0 };
    return { valid: true as const, discount: computeDiscount(coupon, data.subtotal) };
  });

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => placeOrderSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const ids = data.items.map((i) => i.product_id);
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, name_ar, name_en, price, discount_price, stock_qty")
      .in("id", ids);
    if (prodErr) throw new Error(prodErr.message);
    if (!products?.length) throw new Error("No valid products in the order");

    const lines = data.items
      .map((line) => {
        const p = products.find((x) => x.id === line.product_id);
        if (!p) return null;
        const unit =
          p.discount_price != null && Number(p.discount_price) > 0 && Number(p.discount_price) < Number(p.price)
            ? Number(p.discount_price)
            : Number(p.price);
        return {
          product_id: p.id,
          product_name: p.name_ar || p.name_en,
          quantity: line.quantity,
          unit_price: unit,
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);
    if (!lines.length) throw new Error("No valid products in the order");

    const subtotal = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);

    const { data: gov } = await supabase
      .from("governorates")
      .select("id, name_ar, shipping_cost")
      .eq("id", data.governorate_id)
      .maybeSingle();
    const shipping = Number(gov?.shipping_cost ?? 0);

    let discount = 0;
    let couponCode: string | null = null;
    if (data.coupon_code) {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("code, discount_type, discount_value")
        .eq("code", data.coupon_code.toUpperCase())
        .eq("is_active", true)
        .maybeSingle();
      if (coupon) {
        discount = computeDiscount(coupon, subtotal);
        couponCode = coupon.code;
      }
    }

    const total = Math.max(0, subtotal - discount) + shipping;

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        customer_id: userId,
        customer_name: data.full_name,
        phone: data.phone,
        governorate_id: data.governorate_id,
        governorate_name: gov?.name_ar ?? "",
        landmark: data.landmark,
        preferred_delivery_time: data.preferred_delivery_time,
        coupon_code: couponCode,
        discount_amount: discount,
        shipping_fee: shipping,
        subtotal,
        total_amount: total,
        status: "review",
      })
      .select("id, order_number")
      .single();
    if (orderErr) throw new Error(orderErr.message);

    const { error: itemsErr } = await supabase
      .from("order_items")
      .insert(lines.map((l) => ({ ...l, order_id: order.id })));
    if (itemsErr) throw new Error(itemsErr.message);

    // Decrement stock (best effort, admin remains the source of truth).
    for (const l of lines) {
      const p = products.find((x) => x.id === l.product_id);
      if (p) {
        await supabase
          .from("products")
          .update({ stock_qty: Math.max(0, (p.stock_qty ?? 0) - l.quantity) })
          .eq("id", p.id);
      }
    }

    await notifyTelegram(supabase, {
      orderNumber: order.order_number,
      name: data.full_name,
      phone: data.phone,
      governorate: gov?.name_ar ?? "",
      landmark: data.landmark,
      lines,
      total,
    });

    return { id: order.id, order_number: order.order_number };
  });

type NotifyPayload = {
  orderNumber: number;
  name: string;
  phone: string;
  governorate: string;
  landmark: string;
  lines: { product_name: string; quantity: number }[];
  total: number;
};

const GATEWAY = "https://connector-gateway.lovable.dev/telegram";

function tgHeaders(lovableKey: string, telegramKey: string) {
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": telegramKey,
    "Content-Type": "application/json",
  };
}

/**
 * Falls back to discovering the admin's chat id from recent bot updates
 * (the admin only needs to press Start once in Telegram), then persists it.
 */
async function resolveChatId(
  lovableKey: string,
  telegramKey: string,
  username: string,
): Promise<string | null> {
  const res = await fetch(`${GATEWAY}/getUpdates`, {
    method: "POST",
    headers: tgHeaders(lovableKey, telegramKey),
    body: JSON.stringify({ limit: 100 }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    result?: { message?: { chat?: { id?: number; username?: string } } }[];
  };
  const wanted = username.replace(/^@/, "").toLowerCase();
  const hit = (json.result ?? []).find(
    (u) => u.message?.chat?.username?.toLowerCase() === wanted,
  );
  const id = hit?.message?.chat?.id;
  if (!id) return null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("store_settings")
      .upsert({ key: "telegram_chat_id", value: String(id) });
  } catch (err) {
    console.error("Failed to persist telegram chat id", err);
  }
  return String(id);
}

async function notifyTelegram(
  supabase: { from: (t: string) => any },
  payload: NotifyPayload,
): Promise<void> {
  try {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const telegramKey = process.env["TELEGRAM_API_KEY"];
    if (!lovableKey || !telegramKey) return;

    const { data: settings } = await supabase
      .from("store_settings")
      .select("key, value")
      .in("key", ["telegram_chat_id", "telegram_admin_username"]);
    const map = new Map<string, string>(
      (settings ?? []).map((s: { key: string; value: string }) => [s.key, s.value]),
    );
    let chatId = map.get("telegram_chat_id")?.trim();
    if (!chatId) {
      chatId =
        (await resolveChatId(
          lovableKey,
          telegramKey,
          map.get("telegram_admin_username")?.trim() || "HayderZash",
        )) ?? undefined;
    }
    if (!chatId) return;


    const itemLines = payload.lines.map((l) => `• ${l.product_name} × ${l.quantity}`).join("\n");
    const text = [
      `📦 طلب جديد # ${payload.orderNumber}`,
      `👤 الزبون: ${payload.name}`,
      `📞 الهاتف: ${payload.phone}`,
      `📍 المحافظة والنقطة الدالة: ${payload.governorate} - ${payload.landmark}`,
      `🛒 المنتجات:\n${itemLines}`,
      `💰 المبلغ الإجمالي مع التوصيل: ${payload.total.toLocaleString("en-US")} د.ع`,
    ].join("\n");

    const res = await fetch(`${GATEWAY}/sendMessage`, {
      method: "POST",
      headers: tgHeaders(lovableKey, telegramKey),
      body: JSON.stringify({ chat_id: chatId, text }),
    });

    if (!res.ok) {
      console.error(`Telegram notify failed [${res.status}]: ${await res.text()}`);
    }
  } catch (err) {
    console.error("Telegram notify error", err);
  }
}
