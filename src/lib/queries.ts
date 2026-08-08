import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { applyPricing, parsePriceTiers } from "@/lib/format";


export type Product = {
  id: string;
  sku: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  price: number;
  discount_price: number | null;
  category_id: string | null;
  image_url: string | null;
  catalog_pdf_url: string | null;
  stock_qty: number;
  is_featured: boolean;
  images: string[];
  deal_ends_at: string | null;
  created_at: string;
  /** Original prices before the store-wide markup (admin editing uses these). */
  base_price: number;
  base_discount_price: number | null;
};


export type Review = {
  id: string;
  product_id: string;
  author_name: string;
  rating: number;
  comment: string;
  is_approved: boolean;
  created_at: string;
};

export type Category = {
  id: string;
  name_ar: string;
  name_en: string;
  image_url: string | null;
  icon: string;
  parent_id: string | null;
  sort_order: number;
};

const PRODUCT_COLS =
  "id, sku, name_ar, name_en, description_ar, description_en, price, discount_price, category_id, image_url, catalog_pdf_url, stock_qty, is_featured, images, deal_ends_at, created_at";

const PAGE = 1000;

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: async (): Promise<Product[]> => {
    const { data: settingRows } = await supabase
      .from("store_settings")
      .select("key, value")
      .in("key", ["price_tiers", "price_markup_percent"]);
    const map = Object.fromEntries((settingRows ?? []).map((r) => [r.key, r.value]));
    const tiers = parsePriceTiers(
      map["price_tiers"],
      Number(map["price_markup_percent"] ?? 0) || 0,
    );

    // PostgREST caps a single response at 1000 rows — page through everything.
    const all: Product[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_COLS)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as Product[];
      all.push(
        ...rows.map((p) => ({
          ...p,
          base_price: Number(p.price) || 0,
          base_discount_price: p.discount_price === null ? null : Number(p.discount_price),
          price: applyPricing(Number(p.price) || 0, tiers),
          discount_price:
            p.discount_price === null ? null : applyPricing(Number(p.discount_price), tiers),
        })),
      );
      if (rows.length < PAGE) break;
    }
    return all;
  },
});

/** Product ids ordered by how often customers bought them (aggregate only). */
export const popularProductIdsQuery = queryOptions({
  queryKey: ["popular_products"],
  queryFn: async (): Promise<string[]> => {
    const { data, error } = await supabase.rpc("popular_products", { _limit: 20 });
    if (error) throw error;
    return ((data ?? []) as { product_id: string }[]).map((r) => r.product_id);
  },
});


export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async (): Promise<Category[]> => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name_ar, name_en, image_url, icon, parent_id, sort_order")
      .order("sort_order");
    if (error) throw error;
    return (data ?? []) as Category[];
  },
});

export const governoratesQuery = queryOptions({
  queryKey: ["governorates"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("governorates")
      .select("id, name_ar, name_en, shipping_cost, sort_order")
      .order("sort_order");
    if (error) throw error;
    return data ?? [];
  },
});

export const bannersQuery = queryOptions({
  queryKey: ["banners"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("banners")
      .select(
        "id, image_url, title_ar, title_en, description_ar, description_en, link_url, is_active, sort_order",
      )
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw error;
    return data ?? [];
  },
});

export const settingsQuery = queryOptions({
  queryKey: ["store_settings"],
  queryFn: async (): Promise<Record<string, string>> => {
    const { data, error } = await supabase.from("store_settings").select("key, value");
    if (error) throw error;
    return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  },
});

export function myOrdersQuery(userId: string | undefined) {
  return queryOptions({
    queryKey: ["orders", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(id, product_name, quantity, unit_price, is_unavailable)")
        // Admins can read every order via RLS — this page is "my orders" only.
        .eq("customer_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function notificationsQuery(userId: string | undefined) {
  return queryOptions({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, is_read, order_id, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type SupportMessage = {
  id: string;
  user_id: string;
  sender_name: string;
  phone: string;
  message: string;
  is_read: boolean;
  created_at: string;
  admin_reply: string;
  replied_at: string | null;
};

/** All customer support messages (admin) — RLS limits customers to their own. */
export const supportMessagesQuery = queryOptions({
  queryKey: ["support-messages"],
  queryFn: async (): Promise<SupportMessage[]> => {
    const { data, error } = await supabase
      .from("support_messages")
      .select(
        "id, user_id, sender_name, phone, message, is_read, created_at, admin_reply, replied_at",
      )
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) throw error;
    return (data ?? []) as SupportMessage[];
  },
});




export function reviewsQuery(productId: string) {
  return queryOptions({
    queryKey: ["reviews", productId],
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, product_id, author_name, rating, comment, is_approved, created_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Review[];
    },
  });
}

export const allReviewsQuery = queryOptions({
  queryKey: ["reviews", "all"],
  queryFn: async (): Promise<Review[]> => {
    const { data, error } = await supabase
      .from("reviews")
      .select("id, product_id, author_name, rating, comment, is_approved, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Review[];
  },
});

export const couponsQuery = queryOptions({
  queryKey: ["coupons"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("coupons")
      .select("id, code, discount_type, discount_value, is_active")
      .eq("is_active", true);
    if (error) throw error;
    return data ?? [];
  },
});

export const stockAlertsQuery = queryOptions({
  queryKey: ["stock_alerts"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("stock_alerts")
      .select("id, product_id, phone, is_notified, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export type SolarTier = "economy" | "mid" | "pro";

export type SolarComponent = {
  id: string;
  kind: "panel" | "battery" | "inverter";
  name_ar: string;
  name_en: string;
  brand: string;
  tier: SolarTier;
  capacity: number;
  voltage: number;
  price: number;
  is_active: boolean;
  sort_order: number;
};

const SOLAR_COLS =
  "id, kind, name_ar, name_en, brand, tier, capacity, voltage, price, is_active, sort_order";

export const solarComponentsQuery = queryOptions({
  queryKey: ["solar_components"],
  queryFn: async (): Promise<SolarComponent[]> => {
    const { data, error } = await supabase
      .from("solar_components")
      .select(SOLAR_COLS)
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw error;
    return (data ?? []) as SolarComponent[];
  },
});

export const allSolarComponentsQuery = queryOptions({
  queryKey: ["solar_components", "all"],
  queryFn: async (): Promise<SolarComponent[]> => {
    const { data, error } = await supabase
      .from("solar_components")
      .select(SOLAR_COLS)
      .order("kind")
      .order("sort_order");
    if (error) throw error;
    return (data ?? []) as SolarComponent[];
  },
});

