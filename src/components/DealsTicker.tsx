import { Link } from "@tanstack/react-router";
import { Flame } from "lucide-react";

import { discountPercent, formatIQD } from "@/lib/format";
import { localized, useLang } from "@/lib/i18n";

type Deal = {
  id: string;
  name_ar: string;
  name_en: string;
  price: number;
  discount_price: number | null;
};

/** Auto-scrolling strip of discounted products — hidden when there are no deals. */
export function DealsTicker({ products }: { products: Deal[] }) {
  const { lang, t } = useLang();
  const deals = products.filter((p) => discountPercent(p) > 0);
  if (deals.length === 0) return null;

  const loop = deals.length < 6 ? [...deals, ...deals, ...deals] : [...deals, ...deals];

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-destructive/25 bg-destructive/5">
      <div className="flex items-center gap-2 border-b border-destructive/20 px-3 py-2">
        <Flame className="size-4 text-destructive" />
        <span className="text-sm font-bold text-destructive">{t("deals")}</span>
      </div>
      <div className="group relative overflow-hidden py-2">
        <div className="flex w-max animate-marquee gap-2 group-hover:[animation-play-state:paused]">
          {loop.map((p, i) => (
            <Link
              key={`${p.id}-${i}`}
              to="/product/$id"
              params={{ id: p.id }}
              className="flex shrink-0 items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold"
            >
              <span className="rounded-full bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground">
                -{discountPercent(p)}%
              </span>
              <span className="max-w-40 truncate">{localized(lang, p.name_ar, p.name_en)}</span>
              <span className="text-primary">
                {formatIQD(Number(p.discount_price ?? p.price), lang)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
