import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { effectivePrice, formatIQD } from "@/lib/format";
import { localized, useLang } from "@/lib/i18n";
import { categoriesQuery, productsQuery } from "@/lib/queries";

type Search = { q?: string | undefined; cat?: string | undefined };

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: typeof search["q"] === "string" ? search["q"] : undefined,
    cat: typeof search["cat"] === "string" ? search["cat"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "البحث عن المنتجات | SmartTech" },
      { name: "description", content: "ابحث عن المنتجات وفلترها حسب القسم والسعر." },
      { property: "og:title", content: "البحث | SmartTech" },
      { property: "og:description", content: "ابحث وفلتر منتجات المتجر حسب القسم والسعر." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q, cat } = Route.useSearch();
  const { lang, t } = useLang();
  const products = useQuery(productsQuery);
  const categories = useQuery(categoriesQuery);

  const [category, setCategory] = useState(cat ?? "all");
  const maxPrice = useMemo(
    () => Math.max(100000, ...(products.data ?? []).map((p) => effectivePrice(p))),
    [products.data],
  );
  const [range, setRange] = useState<number[]>([0, maxPrice]);
  const hi = range[1] ?? maxPrice;
  const lo = range[0] ?? 0;

  const term = (q ?? "").trim().toLowerCase();
  const results = (products.data ?? []).filter((p) => {
    const price = effectivePrice(p);
    if (category !== "all" && p.category_id !== category) return false;
    if (price < lo || price > Math.max(hi, lo)) return false;
    if (!term) return true;
    return `${p.name_ar} ${p.name_en} ${p.sku}`.toLowerCase().includes(term);
  });

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">
        {t("searchTitle")}
        {term && <span className="text-muted-foreground"> — {q}</span>}
      </h1>

      <div className="mb-5 grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("allCategories")}</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allCategories")}</SelectItem>
              {(categories.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {localized(lang, c.name_ar, c.name_en)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>
            {t("priceRange")}: {formatIQD(lo, lang)} – {formatIQD(Math.max(hi, lo), lang)}
          </Label>
          <Slider
            min={0}
            max={maxPrice}
            step={1000}
            value={[lo, Math.max(hi, lo)]}
            onValueChange={setRange}
            className="pt-3"
          />
        </div>
      </div>

      {products.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{t("noProducts")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
