import { Link } from "@tanstack/react-router";
import { Flame } from "lucide-react";
import { useEffect, useRef } from "react";

import { ProductImage } from "@/components/ProductImage";
import { discountPercent, formatIQD } from "@/lib/format";
import { localized, useLang } from "@/lib/i18n";

type Deal = {
  id: string;
  name_ar: string;
  name_en: string;
  price: number;
  discount_price: number | null;
  image_url?: string | null;
};

/** Auto-scrolling, swipeable strip of discounted products — hidden when there are no deals. */
export function DealsTicker({ products }: { products: Deal[] }) {
  const { lang, t } = useLang();
  const scroller = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const deals = products.filter((p) => discountPercent(p) > 0);

  useEffect(() => {
    const el = scroller.current;
    if (!el || deals.length === 0) return;
    const id = window.setInterval(() => {
      if (paused.current) return;
      const dir = getComputedStyle(el).direction === "rtl" ? -1 : 1;
      const max = el.scrollWidth - el.clientWidth;
      const pos = Math.abs(el.scrollLeft);
      if (pos >= max - 2) el.scrollTo({ left: 0, behavior: "smooth" });
      else el.scrollBy({ left: dir * 1.2, behavior: "auto" });
    }, 16);
    return () => window.clearInterval(id);
  }, [deals.length]);

  if (deals.length === 0) return null;

  const pause = () => {
    paused.current = true;
  };
  const resume = () => {
    paused.current = false;
  };

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-destructive/25 bg-destructive/5">
      <div className="flex items-center gap-2 border-b border-destructive/20 px-3 py-2">
        <Flame className="size-4 text-destructive" />
        <span className="text-sm font-bold text-destructive">{t("deals")}</span>
      </div>
      <div
        ref={scroller}
        onPointerDown={pause}
        onPointerUp={resume}
        onPointerCancel={resume}
        onMouseEnter={pause}
        onMouseLeave={resume}
        onTouchStart={pause}
        onTouchEnd={resume}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {deals.map((p) => (
          <Link
            key={p.id}
            to="/product/$id"
            params={{ id: p.id }}
            className="flex w-40 shrink-0 snap-start flex-col overflow-hidden rounded-xl border bg-card"
          >
            <div className="relative aspect-square bg-sand">
              {p.image_url ? (
                <ProductImage
                  src={p.image_url}
                  alt={localized(lang, p.name_ar, p.name_en)}
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  —
                </div>
              )}
              <span className="absolute top-1.5 left-1.5 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground shadow-sm">
                -{discountPercent(p)}%
              </span>
            </div>
            <div className="flex flex-col gap-0.5 p-2">
              <span className="line-clamp-1 text-xs font-semibold">
                {localized(lang, p.name_ar, p.name_en)}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-bold text-destructive">
                  {formatIQD(Number(p.discount_price ?? p.price), lang)}
                </span>
                <span className="text-[10px] text-muted-foreground line-through">
                  {formatIQD(Number(p.price), lang)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
