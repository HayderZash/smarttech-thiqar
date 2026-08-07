import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

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
  parent_id: string | null;
  sort_order: number;
};

const PRODUCT_COLS =
  "id, sku, name_ar, name_en, description_ar, description_en, price, discount_price, category_id, image_url, catalog_pdf_url, stock_qty, is_featured, images, deal_ends_at, created_at";

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: async (): Promise<Product[]> => {
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_COLS)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Product[];
  },
});

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async (): Promise<Category[]> => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name_ar, name_en, image_url, parent_id, sort_order")
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
      .select("id, image_url, title_ar, title_en, link_url, is_active, sort_order")
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
        .select("*, order_items(id, product_name, quantity, unit_price)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

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
