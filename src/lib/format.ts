export function formatIQD(value: number, lang: "ar" | "en" = "ar") {
  const n = new Intl.NumberFormat(lang === "ar" ? "ar-IQ" : "en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
  return `${n} ${lang === "ar" ? "د.ع" : "IQD"}`;
}

export const ORDER_STATUSES = ["review", "preparing", "shipped", "completed"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number] | "cancelled";

export function statusLabel(status: string, lang: "ar" | "en") {
  const map: Record<string, { ar: string; en: string }> = {
    review: { ar: "مراجعة", en: "Reviewing" },
    preparing: { ar: "تجهيز", en: "Preparing" },
    shipped: { ar: "إرسال", en: "Shipped" },
    completed: { ar: "إكتمال", en: "Completed" },
    cancelled: { ar: "ملغي", en: "Cancelled" },
  };
  return map[status]?.[lang] ?? status;
}

export function effectivePrice(p: { price: number; discount_price: number | null }) {
  return p.discount_price != null && p.discount_price > 0 && p.discount_price < p.price
    ? p.discount_price
    : p.price;
}

export function discountPercent(p: { price: number; discount_price: number | null }) {
  if (!p.discount_price || p.discount_price >= p.price || p.price <= 0) return 0;
  return Math.round(((p.price - p.discount_price) / p.price) * 100);
}

export function whatsappLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
