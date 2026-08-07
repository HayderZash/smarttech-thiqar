/** Converts Arabic-Indic / Persian digits to plain Latin digits. */
export function toLatinDigits(input: string) {
  return input
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function formatIQD(value: number, lang: "ar" | "en" = "ar") {
  // Always render Latin (English) digits, even in Arabic UI.
  const n = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
  return `${n} ${lang === "ar" ? "د.ع" : "IQD"}`;
}

export const ORDER_STATUSES = ["review", "preparing", "shipped", "completed"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number] | "cancelled";

export function statusLabel(status: string, lang: "ar" | "en") {
  const map: Record<string, { ar: string; en: string }> = {
    review: { ar: "جديد", en: "New" },
    preparing: { ar: "قيد التجهيز", en: "Preparing" },
    shipped: { ar: "عند مندوب التوصيل", en: "With courier" },
    completed: { ar: "منجز", en: "Completed" },
    cancelled: { ar: "ملغي", en: "Cancelled" },
  };

/** Plural section titles used in the admin orders tabs. */
}

export function statusGroupLabel(status: string, lang: "ar" | "en") {
  const map: Record<string, { ar: string; en: string }> = {
    review: { ar: "طلبات جديدة", en: "New orders" },
    preparing: { ar: "طلبات قيد التجهيز", en: "Preparing" },
    shipped: { ar: "طلبات عند مندوب التوصيل", en: "With courier" },
    completed: { ar: "طلبات منجزة", en: "Completed orders" },
    cancelled: { ar: "طلبات ملغية", en: "Cancelled orders" },
  };
  return map[status]?.[lang] ?? status;
}

/** Store-wide pricing: tiered markup rounded to the nearest 250 IQD. */
export const PRICE_STEP = 250;

export type PriceTier = {
  /** Upper bound of the base price for this tier (null = no limit). */
  max: number | null;
  /** Percentage added on top of the base price. */
  percent: number;
  /** Flat amount added after the percentage. */
  add: number;
};

/** Defaults follow the requested curve: 5k→7k, 25k→30k, 100k→112k, 172k→180k. */
export const DEFAULT_PRICE_TIERS: PriceTier[] = [
  { max: 10000, percent: 40, add: 0 },
  { max: 50000, percent: 20, add: 0 },
  { max: 150000, percent: 12, add: 0 },
  { max: null, percent: 4.6, add: 0 },
];

/** Reads the tiers stored in store_settings (falls back to the legacy flat percent). */
export function parsePriceTiers(raw: unknown, legacyPercent = 0): PriceTier[] {
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length) {
        const tiers = parsed
          .map((t) => {
            const o = t as Record<string, unknown>;
            const max = o["max"] === null || o["max"] === "" ? null : Number(o["max"]);
            return {
              max: max == null || !Number.isFinite(max) ? null : max,
              percent: Number(o["percent"]) || 0,
              add: Number(o["add"]) || 0,
            };
          })
          .sort((a, b) => (a.max ?? Infinity) - (b.max ?? Infinity));
        return tiers;
      }
    } catch {
      /* fall through to legacy */
    }
  }
  if (legacyPercent) return [{ max: null, percent: legacyPercent, add: 0 }];
  return DEFAULT_PRICE_TIERS;
}

export function tierFor(base: number, tiers: PriceTier[]): PriceTier | null {
  for (const t of tiers) if (t.max == null || base <= t.max) return t;
  return tiers[tiers.length - 1] ?? null;
}

/** Applies the matching tier then rounds to the nearest 250 IQD (never below base). */
export function applyPricing(base: number, tiers: PriceTier[]) {
  const b = Number(base) || 0;
  if (b <= 0) return b;
  const tier = tierFor(b, tiers);
  if (!tier) return b;
  const raised = b * (1 + (Number(tier.percent) || 0) / 100) + (Number(tier.add) || 0);
  const rounded = Math.round(raised / PRICE_STEP) * PRICE_STEP;
  // Never go below the original price (cheap items may round back down).
  return Math.max(b, rounded);
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
