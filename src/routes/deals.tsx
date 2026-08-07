import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, Tag } from "lucide-react";
import { toast } from "sonner";

import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { discountPercent, formatIQD } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { couponsQuery, productsQuery } from "@/lib/queries";

export const Route = createFileRoute("/deals")({
  head: () => ({
    meta: [
      { title: "العروض والتخفيضات | SmartTech" },
      {
        name: "description",
        content: "أقوى العروض والتخفيضات على الإلكترونيات والطاقة الشمسية والمواد الكهربائية في SmartTech.",
      },
      { property: "og:title", content: "العروض والتخفيضات | SmartTech" },
      { property: "og:description", content: "خصومات فعّالة وكوبونات على منتجات SmartTech." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DealsPage,
});

function DealsPage() {
  const { t, lang } = useLang();
  const { data: products } = useQuery(productsQuery);
  const { data: coupons } = useQuery(couponsQuery);

  const deals = (products ?? [])
    .filter((p) => discountPercent(p) > 0)
    .sort((a, b) => discountPercent(b) - discountPercent(a));

  return (
    <div>
      <h1 className="text-xl font-bold">{t("dealsPage")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("dealsDesc")}</p>

      {(coupons ?? []).length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold">{t("activeCoupons")}</h2>
          <div className="flex flex-wrap gap-2">
            {(coupons ?? []).map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 rounded-2xl border border-dashed bg-sand px-3 py-2"
              >
                <Tag className="size-4 text-primary" />
                <span className="font-mono text-sm font-bold" dir="ltr">
                  {c.code}
                </span>
                <span className="text-xs text-muted-foreground">
                  {c.discount_type === "percent"
                    ? `-${c.discount_value}%`
                    : `- ${formatIQD(Number(c.discount_value), lang)}`}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 rounded-full"
                  aria-label={t("copyCode")}
                  onClick={() => {
                    void navigator.clipboard.writeText(c.code);
                    toast.success(t("copied"));
                  }}
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        {deals.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            {t("noDeals")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {deals.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
