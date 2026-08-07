import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { NewsCarousel } from "@/components/NewsCarousel";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { discountPercent } from "@/lib/format";
import { CategoryIcon } from "@/lib/category-icons";
import { localized, useLang } from "@/lib/i18n";
import { bannersQuery, categoriesQuery, productsQuery } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SmartTech | إلكترونيات وكهربائيات وطاقة شمسية" },
      {
        name: "description",
        content:
          "تسوق الإلكترونيات والمواد الكهربائية ومنظومات الطاقة الشمسية ومواد البناء مع توصيل لكل محافظات العراق.",
      },
      { property: "og:title", content: "SmartTech | تسوق أونلاين في العراق" },
      {
        property: "og:description",
        content: "إلكترونيات، كهربائيات، طاقة شمسية ومواد بناء مع توصيل لجميع المحافظات.",
      },
    ],
  }),
  component: Home,
});

function Section({
  title,
  children,
  to,
}: {
  title: string;
  children: React.ReactNode;
  to?: { to: string; search?: Record<string, string> };
}) {
  const { t } = useLang();
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        {to && (
          <Link
            to="/search"
            search={to.search ?? {}}
            className="flex items-center gap-0.5 text-sm font-medium text-primary"
          >
            {t("viewAll")}
            <ChevronLeft className="size-4 rtl:rotate-0 ltr:rotate-180" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

function Home() {
  const { lang, t } = useLang();
  const products = useQuery(productsQuery);
  const categories = useQuery(categoriesQuery);
  const banners = useQuery(bannersQuery);

  const all = products.data ?? [];
  const latest = all.slice(0, 8);
  const deals = all.filter((p) => discountPercent(p) > 0).slice(0, 8);
  const lastPieces = all.filter((p) => p.stock_qty > 0 && p.stock_qty <= 2).slice(0, 8);
  const featured = all.filter((p) => p.is_featured).slice(0, 8);
  const roots = (categories.data ?? []).filter((c) => !c.parent_id);

  return (
    <div>
      <h1 className="sr-only">SmartTech — إلكترونيات وكهربائيات وطاقة شمسية</h1>

      {banners.data && banners.data.length > 0 && (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
          {banners.data.map((b) => (
            <a
              key={b.id}
              href={b.link_url ?? "#"}
              className="relative aspect-[16/7] w-[85%] shrink-0 snap-center overflow-hidden rounded-2xl bg-sand sm:w-[60%] lg:w-[48%]"
            >
              <img
                src={b.image_url}
                alt={localized(lang, b.title_ar, b.title_en)}
                className="h-full w-full object-cover"
              />
            </a>
          ))}
        </div>
      )}

      {roots.length > 0 && (
        <Section title={t("shopByCategory")}>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {roots.map((c) => (
              <Link
                key={c.id}
                to="/categories"
                search={{ cat: c.id }}
                className="flex w-24 shrink-0 flex-col items-center gap-2"
              >
                <span className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border bg-sand">
                  {c.image_url ? (
                    <img src={c.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold text-primary">
                      {localized(lang, c.name_ar, c.name_en).charAt(0)}
                    </span>
                  )}
                </span>
                <span className="line-clamp-2 text-center text-xs font-medium">
                  {localized(lang, c.name_ar, c.name_en)}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {products.isLoading && (
        <Section title={t("latest")}>
          <Grid>
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </Grid>
        </Section>
      )}

      {featured.length > 0 && (
        <Section title={t("featured")}>
          <Grid>
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </Grid>
        </Section>
      )}

      {latest.length > 0 && (
        <Section title={t("latest")} to={{ to: "/search" }}>
          <Grid>
            {latest.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </Grid>
        </Section>
      )}

      {deals.length > 0 && (
        <Section title={t("deals")}>
          <Grid>
            {deals.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </Grid>
        </Section>
      )}

      {lastPieces.length > 0 && (
        <Section title={t("lastPieces")}>
          <Grid>
            {lastPieces.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </Grid>
        </Section>
      )}

      {!products.isLoading && all.length === 0 && (
        <p className="py-16 text-center text-sm text-muted-foreground">{t("noProducts")}</p>
      )}
    </div>
  );
}
