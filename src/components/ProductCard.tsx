import { Link } from "@tanstack/react-router";
import { Heart, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { localized, useLang } from "@/lib/i18n";
import { discountPercent, effectivePrice, formatIQD } from "@/lib/format";
import type { Product } from "@/lib/queries";
import { ProductImage } from "@/components/ProductImage";
import { useWishlist } from "@/lib/wishlist";
import { cn } from "@/lib/utils";

export function StockBadge({ qty, className }: { qty: number; className?: string }) {
  const { t } = useLang();
  if (qty <= 0)
    return (
      <Badge variant="destructive" className={cn("rounded-full", className)}>
        {t("outOfStock")}
      </Badge>
    );
  if (qty <= 2)
    return (
      <Badge
        className={cn("rounded-full bg-warning text-warning-foreground hover:bg-warning", className)}
      >
        {t("lastTwo")}
      </Badge>
    );
  return (
    <Badge
      className={cn("rounded-full bg-primary-soft text-accent-foreground hover:bg-primary-soft", className)}
    >
      {t("inStock")}
    </Badge>
  );
}

export function ProductCard({
  product,
  categoryPath,
}: {
  product: Product;
  categoryPath?: string | undefined;
}) {
  const { lang, t } = useLang();
  const { add } = useCart();
  const wishlist = useWishlist();
  const off = discountPercent(product);
  const price = effectivePrice(product);
  const liked = wishlist.has(product.id);
  const soldOut = product.stock_qty <= 0;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5">
      <button
        type="button"
        aria-label={t("wishlist")}
        onClick={() => {
          wishlist.toggle(product.id);
          toast.success(liked ? t("removedFromWishlist") : t("addedToWishlist"));
        }}
        className="absolute top-2 end-2 z-10 flex size-8 items-center justify-center rounded-full bg-background/85 backdrop-blur transition-colors hover:bg-background"
      >
        <Heart className={cn("size-4", liked ? "fill-destructive text-destructive" : "text-muted-foreground")} />
      </button>

      <Link to="/product/$id" params={{ id: product.id }} className="flex flex-1 flex-col">
        <div className="relative aspect-square overflow-hidden bg-sand">
          {product.image_url ? (
            <ProductImage
              src={product.image_url}
              alt={localized(lang, product.name_ar, product.name_en)}
              loading="lazy"
              className="transition-transform duration-300 group-hover:scale-105"
            />

          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              {product.sku || "—"}
            </div>
          )}
          {off > 0 && (
            <span className="absolute top-2 left-2 rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground shadow-sm">
              -{off}%
            </span>
          )}
          <StockBadge qty={product.stock_qty} className="absolute bottom-2 start-2 text-[10px]" />
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3 pb-2">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
            {localized(lang, product.name_ar, product.name_en)}
          </h3>
          {categoryPath && (
            <span className="line-clamp-1 text-[11px] text-muted-foreground">{categoryPath}</span>
          )}
          <div className="mt-auto flex flex-wrap items-baseline gap-2">
            <span className={cn("text-base font-bold", off > 0 ? "text-destructive" : "text-primary")}>
              {formatIQD(price, lang)}
            </span>
            {off > 0 && (
              <span className="text-xs text-muted-foreground line-through">
                {formatIQD(product.price, lang)}
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="px-3 pb-3">
        <Button
          size="sm"
          variant="secondary"
          className="h-9 w-full rounded-full text-xs font-semibold"
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
              1,
            );
            toast.success(t("addedToCart"));
          }}
        >
          <ShoppingCart className="size-4" />
          {soldOut ? t("outOfStock") : t("addToCart")}
        </Button>
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="aspect-square animate-pulse bg-muted" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
