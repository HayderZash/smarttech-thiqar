import type { Config, Context } from "@netlify/functions";

/**
 * Telegram notifier for new orders — runs on Netlify.
 *
 * It is called by a database trigger right after the order items are stored,
 * so it works even when the site is hosted outside Lovable.
 *
 * Required Netlify environment variables:
 *  - TELEGRAM_BOT_TOKEN  : bot token from @BotFather
 *  - TELEGRAM_CHAT_ID    : chat id that receives the messages
 *  - ORDER_WEBHOOK_SECRET: shared secret, same value stored in the database
 */

type Line = {
  product_name: string;
  quantity: number;
  unit_price: number | null;
};

type Payload = {
  order?: {
    order_number?: number | string;
    customer_name?: string;
    phone?: string;
    governorate_name?: string;
    landmark?: string | null;
    preferred_delivery_time?: string | null;
    notes?: string | null;
    coupon_code?: string | null;
    discount_amount?: number | null;
    shipping_fee?: number | null;
    subtotal?: number | null;
    total_amount?: number | null;
  };
  items?: Line[];
  text?: string;
};

const iqd = (n: number): string => `${Math.round(n).toLocaleString("en-US")} د.ع`;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function buildMessage(payload: Payload): string {
  if (payload.text) return payload.text;
  const o = payload.order ?? {};
  const items = payload.items ?? [];
  const lines = items
    .map((l) => {
      const unit = Number(l.unit_price ?? 0);
      return `• ${l.product_name} × ${l.quantity}${unit ? ` — ${iqd(unit)}` : ""}`;
    })
    .join("\n");

  const parts = [
    `🛒 طلب جديد #${o.order_number ?? ""}`,
    `الزبون: ${o.customer_name ?? ""}`,
    `الهاتف: ${o.phone ?? ""}`,
    `المحافظة: ${o.governorate_name ?? ""}`,
    o.landmark ? `أقرب نقطة دالة: ${o.landmark}` : "",
    o.preferred_delivery_time ? `وقت التسليم المفضل: ${o.preferred_delivery_time}` : "",
    "",
    lines || "—",
    "",
    o.subtotal != null ? `المجموع: ${iqd(Number(o.subtotal))}` : "",
    o.shipping_fee != null ? `التوصيل: ${iqd(Number(o.shipping_fee))}` : "",
    Number(o.discount_amount ?? 0) > 0
      ? `الخصم${o.coupon_code ? ` (${o.coupon_code})` : ""}: -${iqd(Number(o.discount_amount))}`
      : "",
    o.total_amount != null ? `الإجمالي: ${iqd(Number(o.total_amount))}` : "",
    o.notes ? `ملاحظات: ${o.notes}` : "",
  ];
  return parts.filter(Boolean).join("\n");
}

export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const secret = process.env["ORDER_WEBHOOK_SECRET"];
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const chatId = process.env["TELEGRAM_CHAT_ID"];
  if (!secret || !token || !chatId) {
    return new Response("Not configured", { status: 500 });
  }

  const provided = request.headers.get("x-webhook-secret") ?? "";
  if (!safeEqual(provided, secret)) return new Response("Unauthorized", { status: 401 });

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const text = buildMessage(payload);
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`Telegram sendMessage failed [${res.status}]: ${body}`);
    return new Response(body, { status: 502 });
  }
  return Response.json({ ok: true });
};

export const config: Config = {
  path: "/api/public/telegram/order",
};
