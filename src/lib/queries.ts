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
  "id, sku, name_ar, name_en, description_ar, description_en, price, discount_price, category_id, image_url, catalog_pdf_url, stock_qty, is_featured, created_at";

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
