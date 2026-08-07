import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Pagination } from "@/components/Pagination";
import { ProductCard } from "@/components/ProductCard";
import { discountPercent } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { productsQuery } from "@/lib/queries";

const PER_PAGE = 30;

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
  const { t } = useLang();
  const { data: products } = useQuery(productsQuery);

  const [page, setPage] = useState(1);

  const deals = (products ?? [])
    .filter((p) => discountPercent(p) > 0)
    .sort((a, b) => discountPercent(b) - discountPercent(a));

  const totalPages = Math.max(1, Math.ceil(deals.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = deals.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  return (
    <div>
      <h1 className="text-xl font-bold">{t("dealsPage")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("dealsDesc")}</p>

      <section className="mt-6">
        {deals.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            {t("noDeals")}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {pageItems.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />
          </>
        )}
      </section>
    </div>
  );
}
