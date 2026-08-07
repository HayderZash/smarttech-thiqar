import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Pagination } from "@/components/Pagination";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
import { CategoryIcon } from "@/lib/category-icons";
import { categoriesQuery, productsQuery } from "@/lib/queries";

const PER_PAGE = 30;

type Search = { q?: string | undefined; cat?: string | undefined };
type SortKey = "newest" | "name_asc" | "name_desc" | "price_asc" | "price_desc";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: typeof search["q"] === "string" ? search["q"] : undefined,
    cat: typeof search["cat"] === "string" ? search["cat"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "البحث عن المنتجات | SmartTech" },
      { name: "description", content: "ابحث عن المنتجات وفلترها حسب القسم والسعر والترتيب." },
      { property: "og:title", content: "البحث | SmartTech" },
      { property: "og:description", content: "ابحث وفلتر منتجات المتجر حسب القسم والسعر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q, cat } = Route.useSearch();
  const navigate = useNavigate();
  const { lang, t } = useLang();
  const products = useQuery(productsQuery);
  const categories = useQuery(categoriesQuery);

  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const maxPrice = useMemo(
    () => Math.max(100000, ...(products.data ?? []).map((p) => effectivePrice(p))),
    [products.data],
  );
  const [range, setRange] = useState<number[]>([0, maxPrice]);
  const hi = range[1] ?? maxPrice;
  const lo = range[0] ?? 0;

  useEffect(() => {
    setPage(1);
  }, [q, cat, sort, lo, hi]);

  const allCats = categories.data ?? [];
  const category = cat ?? "all";
  const activeCat = allCats.find((c) => c.id === category);
  const parentCat = activeCat?.parent_id
    ? allCats.find((c) => c.id === activeCat.parent_id)
    : undefined;
  const subCats = activeCat ? allCats.filter((c) => c.parent_id === activeCat.id) : [];

  const uncategorized = category === "none";
  const generalLabel = lang === "ar" ? "العام" : "General";
  const catIds =

    category === "all" || uncategorized
      ? null
      : [category, ...allCats.filter((c) => c.parent_id === category).map((c) => c.id)];

  const term = (q ?? "").trim().toLowerCase();
  const results = (products.data ?? [])
    .filter((p) => {
      const price = effectivePrice(p);
      if (uncategorized && p.category_id) return false;
      if (catIds && !(p.category_id && catIds.includes(p.category_id))) return false;

      if (price < lo || price > Math.max(hi, lo)) return false;
      if (!term) return true;
      return `${p.name_ar} ${p.name_en} ${p.sku}`.toLowerCase().includes(term);
    })
    .sort((a, b) => {
      const nameA = localized(lang, a.name_ar, a.name_en);
      const nameB = localized(lang, b.name_ar, b.name_en);
      switch (sort) {
        case "name_asc":
          return nameA.localeCompare(nameB, lang);
        case "name_desc":
          return nameB.localeCompare(nameA, lang);
        case "price_asc":
          return effectivePrice(a) - effectivePrice(b);
        case "price_desc":
          return effectivePrice(b) - effectivePrice(a);
        default:
          return 0;
      }
    });

  const totalPages = Math.max(1, Math.ceil(results.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = results.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const catPath = (id: string | null) => {
    if (!id) return generalLabel;
    const c = allCats.find((x) => x.id === id);
    if (!c) return generalLabel;
    const parent = c.parent_id ? allCats.find((x) => x.id === c.parent_id) : undefined;
    const name = localized(lang, c.name_ar, c.name_en);
    return parent ? `${localized(lang, parent.name_ar, parent.name_en)} › ${name}` : name;
  };

  return (
    <div>
      <Breadcrumb className="mb-3">
        <BreadcrumbList className="text-xs sm:text-sm">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">{t("home")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="rtl:rotate-180" />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/categories">{t("categories")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {parentCat && (
            <>
              <BreadcrumbSeparator className="rtl:rotate-180" />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/search" search={{ cat: parentCat.id }}>
                    {localized(lang, parentCat.name_ar, parentCat.name_en)}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator className="rtl:rotate-180" />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {activeCat
                ? localized(lang, activeCat.name_ar, activeCat.name_en)
                : uncategorized
                  ? generalLabel
                  : t("allCategories")}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="mb-4 text-xl font-bold">
        {activeCat
          ? localized(lang, activeCat.name_ar, activeCat.name_en)
          : uncategorized
            ? generalLabel
            : t("searchTitle")}
        {term && <span className="text-muted-foreground"> — {q}</span>}
      </h1>

      {subCats.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="self-center text-xs text-muted-foreground">{t("subCategories")}:</span>
          {subCats.map((s) => (
            <Link
              key={s.id}
              to="/search"
              search={{ cat: s.id }}
              className="flex items-center gap-1.5 rounded-full bg-sand px-3 py-1 text-xs font-medium hover:bg-primary-soft"
            >
              <span className="flex size-5 items-center justify-center overflow-hidden rounded-full bg-card">
                <CategoryIcon
                  icon={s.icon}
                  imageUrl={s.image_url}
                  fallback={localized(lang, s.name_ar, s.name_en).charAt(0)}
                  className="!text-[10px]"
                />
              </span>
              {localized(lang, s.name_ar, s.name_en)}
            </Link>
          ))}
        </div>
      )}


      <div className="mb-5 grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>{t("allCategories")}</Label>
          <Select
            value={category}
            onValueChange={(v) =>
              navigate({
                to: "/search",
                search: (prev: Search): Search => ({ ...prev, cat: v === "all" ? undefined : v }),
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allCategories")}</SelectItem>
              <SelectItem value="none">{generalLabel}</SelectItem>

              {allCats.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {localized(lang, c.name_ar, c.name_en)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("sortBy")}</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t("sortNewest")}</SelectItem>
              <SelectItem value="name_asc">{t("sortNameAsc")}</SelectItem>
              <SelectItem value="name_desc">{t("sortNameDesc")}</SelectItem>
              <SelectItem value="price_asc">{t("sortPriceAsc")}</SelectItem>
              <SelectItem value="price_desc">{t("sortPriceDesc")}</SelectItem>
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
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            {t("products")}: {results.length}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {pageItems.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  );
}
