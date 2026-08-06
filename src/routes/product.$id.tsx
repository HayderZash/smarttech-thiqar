import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileDown, Minus, Plus, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ProductCard, StockBadge } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { discountPercent, effectivePrice, formatIQD } from "@/lib/format";
import { localized, useLang } from "@/lib/i18n";
import { productsQuery } from "@/lib/queries";

export const Route = createFileRoute("/product/$id")({
  head: () => ({
    meta: [
      { title: "تفاصيل المنتج | متجر النور" },
      { name: "description", content: "تفاصيل المنتج والسعر وحالة التوفر والكتالوج الفني." },
      { property: "og:title", content: "تفاصيل المنتج | متجر النور" },
      { property: "og:description", content: "اطلع على تفاصيل المنتج وأضفه إلى سلتك." },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { lang, t } = useLang();
  const { add } = useCart();
  const { data, isLoading } = useQuery(productsQuery);
  const [qty, setQty] = useState(1);

  const product = (data ?? []).find((p) => p.id === id);

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
  const related = (data ?? [])
    .filter((p) => p.id !== product.id && p.category_id === product.category_id)
    .slice(0, 4);

  return (
    <div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl border bg-sand">
          <div className="aspect-square">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={localized(lang, product.name_ar, product.name_en)}
                className="h-full w-full object-cover"
              />
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

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <StockBadge qty={product.stock_qty} />
            <h1 className="text-xl font-bold leading-snug">
              {localized(lang, product.name_ar, product.name_en)}
            </h1>
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
              disabled={soldOut}
              onClick={() => {
                add(
                  {
                    id: product.id,
                    name_ar: product.name_ar,
                    name_en: product.name_en,
                    price,
                    image_url: product.image_url,
                  },
                  qty,
                );
                toast.success(t("addedToCart"));
              }}
            >
              <ShoppingCart className="size-5" />
              {soldOut ? t("outOfStock") : t("addToCart")}
            </Button>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-9">
          <h2 className="mb-3 text-lg font-bold">{t("featured")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
