import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, FileDown, Heart, Minus, Plus, Share2, ShoppingCart, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Countdown } from "@/components/Countdown";
import { ProductCard, StockBadge } from "@/components/ProductCard";
import { ProductImage } from "@/components/ProductImage";
import { ProductReviews } from "@/components/ProductReviews";
import { StockAlert } from "@/components/StockAlert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCart } from "@/lib/cart";
import { discountPercent, effectivePrice, formatIQD } from "@/lib/format";
import { localized, useLang } from "@/lib/i18n";
import { categoriesQuery, governoratesQuery, productsQuery } from "@/lib/queries";
import { categoryChain } from "@/lib/category-path";
import { getRecent, pushRecent } from "@/lib/recent";
import { useWishlist } from "@/lib/wishlist";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/product/$id")({
  head: () => ({
    meta: [
      { title: "تفاصيل المنتج | SmartTech" },
      { name: "description", content: "تفاصيل المنتج والسعر وحالة التوفر والكتالوج الفني." },
      { property: "og:title", content: "تفاصيل المنتج | SmartTech" },
      { property: "og:description", content: "اطلع على تفاصيل المنتج وأضفه إلى سلتك." },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { lang, t } = useLang();
  const { add } = useCart();
  const wishlist = useWishlist();
  const { data, isLoading } = useQuery(productsQuery);
  const { data: govs } = useQuery(governoratesQuery);
  const { data: cats } = useQuery(categoriesQuery);
  const [qty, setQty] = useState(1);
  const [active, setActive] = useState(0);
  const [gov, setGov] = useState<string>("");
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    setRecentIds(getRecent().filter((x) => x !== id));
    pushRecent(id);
    setActive(0);
    setQty(1);
  }, [id]);

  const product = (data ?? []).find((p) => p.id === id);

  const gallery = useMemo(() => {
    if (!product) return [] as string[];
    const list = [product.image_url, ...(product.images ?? [])].filter(Boolean) as string[];
    return Array.from(new Set(list));
  }, [product]);

  if (isLoading) {
    return <div className="h-72 animate-pulse rounded-2xl bg-muted" />;
  }
  if (!product) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">{t("noProducts")}</p>
        <Link to="/" className="mt-4 inline-block text-sm font-semibold text-primary">
          {t("home")}
        </Link>
      </div>
    );
  }

  const price = effectivePrice(product);
  const off = discountPercent(product);
  const soldOut = product.stock_qty <= 0;
  const liked = wishlist.has(product.id);
  const related = (data ?? [])
    .filter((p) => p.id !== product.id && p.category_id === product.category_id)
    .slice(0, 4);
  const recent = (data ?? []).filter((p) => recentIds.includes(p.id)).slice(0, 4);
  const shipping = govs?.find((g) => g.id === gov)?.shipping_cost;
  const name = localized(lang, product.name_ar, product.name_en);
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const chain = categoryChain(cats ?? [], product.category_id);

  return (
    <div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl border bg-sand">
            <div className="relative aspect-square overflow-hidden">
              {gallery[active] ? (
                <ProductImage src={gallery[active]} alt={name} />

              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {product.sku}
                </div>
              )}
            </div>
            {off > 0 && (
              <span className="absolute top-3 start-3 rounded-full bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground">
                -{off}%
              </span>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {gallery.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setActive(i)}
                  className={cn(
                    "size-16 shrink-0 overflow-hidden rounded-xl border-2",
                    i === active ? "border-primary" : "border-transparent",
                  )}
                >
                  <img
                    src={src}
                    alt=""
                    className="h-full w-full scale-[1.35] object-cover object-center"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StockBadge qty={product.stock_qty} />
              {product.deal_ends_at && <Countdown endsAt={product.deal_ends_at} />}
            </div>
            <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <Link to="/categories" className="hover:text-primary">
                {t("categories")}
              </Link>
              {chain.length === 0 ? (
                <>
                  <span>›</span>
                  <Link to="/search" search={{ cat: "none" }} className="hover:text-primary">
                    {lang === "ar" ? "العام" : "General"}
                  </Link>
                </>
              ) : (
                chain.map((c) => (
                  <span key={c.id} className="flex items-center gap-1">
                    <span>›</span>
                    <Link to="/search" search={{ cat: c.id }} className="font-medium hover:text-primary">
                      {localized(lang, c.name_ar, c.name_en)}
                    </Link>
                  </span>
                ))
              )}
            </div>
            <h1 className="text-xl font-bold leading-snug">{name}</h1>
            {product.sku && (
              <p className="text-xs text-muted-foreground">
                {t("code")}: {product.sku}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-2xl font-extrabold text-primary">{formatIQD(price, lang)}</span>
            {off > 0 && (
              <span className="text-sm text-muted-foreground line-through">
                {formatIQD(product.price, lang)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-accent-foreground">
              <BadgeCheck className="size-3.5" />
              {t("cod")}
            </span>
            <button
              type="button"
              onClick={() => {
                wishlist.toggle(product.id);
                toast.success(liked ? t("removedFromWishlist") : t("addedToWishlist"));
              }}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
            >
              <Heart className={cn("size-3.5", liked && "fill-destructive text-destructive")} />
              {t("wishlist")}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${name} — ${formatIQD(price, lang)}\n${shareUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
            >
              <Share2 className="size-3.5" />
              {t("share")}
            </a>
          </div>

          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {localized(lang, product.description_ar, product.description_en)}
          </p>

          {product.catalog_pdf_url && (
            <a
              href={product.catalog_pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-4 py-2 text-sm font-semibold text-accent-foreground"
            >
              <FileDown className="size-4" />
              {t("downloadCatalog")}
            </a>
          )}

          <div className="rounded-2xl border bg-card p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Truck className="size-4 text-primary" />
              {t("shippingCalc")}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={gov} onValueChange={setGov}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t("chooseGovernorate")} />
                </SelectTrigger>
                <SelectContent>
                  {(govs ?? []).map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {localized(lang, g.name_ar, g.name_en)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {shipping != null && (
                <span className="text-sm font-bold text-primary">
                  {shipping > 0 ? formatIQD(shipping, lang) : t("freeShipping")}
                </span>
              )}
            </div>
          </div>

          {soldOut ? (
            <StockAlert productId={product.id} />
          ) : (
            <div className="mt-auto flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-full border bg-card p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-full"
                  aria-label="-"
                  onClick={() => setQty((n) => Math.max(1, n - 1))}
                >
                  <Minus className="size-4" />
                </Button>
                <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-full"
                  aria-label="+"
                  onClick={() => setQty((n) => Math.min(product.stock_qty || 1, n + 1))}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              <Button
                className="h-12 flex-1 rounded-full text-base"
                onClick={() => {
                  add(
                    {
                      id: product.id,
                      name_ar: product.name_ar,
                      name_en: product.name_en,
                      price,
                      original_price: product.price,
                      image_url: product.image_url,
                    },
                    qty,
                  );
                  toast.success(t("addedToCart"));
                }}
              >
                <ShoppingCart className="size-5" />
                {t("addToCart")}
              </Button>
            </div>
          )}
        </div>
      </div>

      <ProductReviews productId={product.id} />

      {related.length > 0 && (
        <section className="mt-9">
          <h2 className="mb-3 text-lg font-bold">{t("related")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="mt-9">
          <h2 className="mb-3 text-lg font-bold">{t("recentlyViewed")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {recent.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
