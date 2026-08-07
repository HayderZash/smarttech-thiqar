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

const PRICE_STEP = 250;

/** Adds the store-wide markup then rounds to the nearest 250 IQD (never below base). */
function applyMarkup(base: number, percent: number) {
  const b = Number(base) || 0;
  if (!percent || b <= 0) return b;
  return Math.max(b, Math.round((b * (1 + percent / 100)) / PRICE_STEP) * PRICE_STEP);
}

async function getMarkup(supabase: {
  from: (t: string) => any;
}): Promise<number> {
  const { data } = await supabase
    .from("store_settings")
    .select("value")
    .eq("key", "price_markup_percent")
    .maybeSingle();
  return Number(data?.value ?? 0) || 0;
}

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

    // First-time customer: automatic 5% off, once, on their very first order.
    const { count: previousOrders } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", userId);
    if (!previousOrders) {
      discount += Math.round((subtotal * 5) / 100);
    }
    discount = Math.max(0, Math.min(subtotal, discount));

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

/** Sends a plain text message to the store's Telegram admin chat. */
async function sendTelegramText(
  supabase: { from: (t: string) => any },
  text: string,
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

async function notifyTelegram(
  supabase: { from: (t: string) => any },
  payload: NotifyPayload,
): Promise<void> {
  const itemLines = payload.lines.map((l) => `• ${l.product_name} × ${l.quantity}`).join("\n");
  const text = [
    `📦 طلب جديد # ${payload.orderNumber}`,
    `👤 الزبون: ${payload.name}`,
    `📞 الهاتف: ${payload.phone}`,
    `📍 المحافظة والنقطة الدالة: ${payload.governorate} - ${payload.landmark}`,
    `🛒 المنتجات:\n${itemLines}`,
    `💰 المبلغ الإجمالي مع التوصيل: ${payload.total.toLocaleString("en-US")} د.ع`,
  ].join("\n");
  await sendTelegramText(supabase, text);
}


const unavailableSchema = z.object({
  order_item_id: z.string().uuid(),
  is_unavailable: z.boolean(),
});

/** Admin marks an order line as unavailable, recalculates totals and notifies the customer. */
export const setItemUnavailable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => unavailableSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: item, error: itemErr } = await supabaseAdmin
      .from("order_items")
      .update({ is_unavailable: data.is_unavailable })
      .eq("id", data.order_item_id)
      .select("id, order_id, product_name")
      .single();
    if (itemErr) throw new Error(itemErr.message);

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, customer_id, shipping_fee, discount_amount, status")
      .eq("id", item.order_id)
      .single();
    if (!order) throw new Error("Order not found");

    const { data: lines } = await supabaseAdmin
      .from("order_items")
      .select("quantity, unit_price, is_unavailable")
      .eq("order_id", item.order_id);

    const subtotal = (lines ?? [])
      .filter((l) => !l.is_unavailable)
      .reduce((s, l) => s + Number(l.unit_price) * Number(l.quantity), 0);
    const discount = Math.min(Number(order.discount_amount ?? 0), subtotal);
    const total = Math.max(0, subtotal - discount) + Number(order.shipping_fee ?? 0);

    await supabaseAdmin
      .from("orders")
      .update({
        subtotal,
        discount_amount: discount,
        total_amount: total,
        needs_customer_action: data.is_unavailable ? true : false,
      })
      .eq("id", order.id);

    if (data.is_unavailable && order.customer_id) {
      await supabaseAdmin.from("notifications").insert({
        user_id: order.customer_id,
        order_id: order.id,
        title: `المنتج «${item.product_name}» غير متوفر`,
        body: `بخصوص طلبك رقم #${order.order_number}: المنتج غير متوفر حالياً. يمكنك إكمال الطلب بدونه أو طلب تغييره قبل بدء التجهيز.`,
      });
    }

    return { ok: true as const, total };
  });

const resolveSchema = z.object({
  order_id: z.string().uuid(),
  action: z.enum(["continue", "change"]),
});

/** Customer answers the "item unavailable" prompt (only before preparation starts). */
export const resolveOrderIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => resolveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, status, customer_id, notes")
      .eq("id", data.order_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order || order.customer_id !== userId) throw new Error("Order not found");
    if (order.status !== "review") throw new Error("CANNOT_CANCEL");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const note =
      data.action === "continue"
        ? "الزبون وافق على إكمال الطلب بدون المنتج غير المتوفر."
        : "الزبون يريد تغيير المنتج غير المتوفر — يرجى التواصل معه.";
    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({ needs_customer_action: false, notes: note })
      .eq("id", order.id)
      .eq("status", "review");
    if (updErr) throw new Error(updErr.message);
    return { ok: true as const };
  });

const cancelSchema = z.object({ order_id: z.string().uuid() });


/** Customers may cancel their own order only while it is still under review. */
export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cancelSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, status, customer_id")
      .eq("id", data.order_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order || order.customer_id !== userId) throw new Error("Order not found");
    if (order.status !== "review") throw new Error("CANNOT_CANCEL");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", order.id)
      .eq("status", "review");
    if (updErr) throw new Error(updErr.message);
    return { ok: true as const };
  });

const addItemSchema = z.object({
  order_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
});

/** Customer adds a product to an existing order, allowed only before preparation starts. */
export const addOrderItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => addItemSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, order_number, status, customer_id, customer_name, phone, shipping_fee, discount_amount, governorate_name, landmark")
      .eq("id", data.order_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order || order.customer_id !== userId) throw new Error("Order not found");
    if (order.status !== "review") throw new Error("CANNOT_MODIFY");

    const { data: product } = await supabase
      .from("products")
      .select("id, name_ar, name_en, price, discount_price")
      .eq("id", data.product_id)
      .maybeSingle();
    if (!product) throw new Error("Product not found");

    const unit =
      product.discount_price != null &&
      Number(product.discount_price) > 0 &&
      Number(product.discount_price) < Number(product.price)
        ? Number(product.discount_price)
        : Number(product.price);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("order_items")
      .select("id, quantity")
      .eq("order_id", order.id)
      .eq("product_id", product.id)
      .eq("is_unavailable", false)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("order_items")
        .update({ quantity: Number(existing.quantity) + data.quantity, unit_price: unit })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("order_items").insert({
        order_id: order.id,
        product_id: product.id,
        product_name: product.name_ar || product.name_en,
        quantity: data.quantity,
        unit_price: unit,
      });
    }

    const { data: lines } = await supabaseAdmin
      .from("order_items")
      .select("product_name, quantity, unit_price, is_unavailable")
      .eq("order_id", order.id);

    const active = (lines ?? []).filter((l) => !l.is_unavailable);
    const subtotal = active.reduce((s, l) => s + Number(l.unit_price) * Number(l.quantity), 0);
    const discount = Math.min(Number(order.discount_amount ?? 0), subtotal);
    const total = Math.max(0, subtotal - discount) + Number(order.shipping_fee ?? 0);

    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({ subtotal, discount_amount: discount, total_amount: total })
      .eq("id", order.id)
      .eq("status", "review");
    if (updErr) throw new Error(updErr.message);

    const itemLines = active.map((l) => `• ${l.product_name} × ${l.quantity}`).join("\n");
    await sendTelegramText(supabase, [
      `✏️ تعديل طلب # ${order.order_number} — إضافة منتج`,
      `👤 الزبون: ${order.customer_name}`,
      `📞 الهاتف: ${order.phone}`,
      `📍 ${order.governorate_name} - ${order.landmark}`,
      `➕ تمت إضافة: ${product.name_ar || product.name_en} × ${data.quantity}`,
      `🛒 القائمة النهائية:\n${itemLines}`,
      `💰 المبلغ الإجمالي مع التوصيل: ${total.toLocaleString("en-US")} د.ع`,
    ].join("\n"));

    return { ok: true as const, total };
  });
