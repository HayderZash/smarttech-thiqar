import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { localized, useLang } from "@/lib/i18n";
import { categoriesQuery, productsQuery } from "@/lib/queries";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "الأقسام | SmartTech" },
      {
        name: "description",
        content: "تصفح أقسام المتجر: إلكترونيات، كهربائيات، طاقة شمسية، مواد بناء ومستلزمات عامة.",
      },
      { property: "og:title", content: "أقسام SmartTech" },
      { property: "og:description", content: "تصفح كل أقسام المتجر والأقسام الفرعية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { lang, t } = useLang();
  const categories = useQuery(categoriesQuery);
  const products = useQuery(productsQuery);

  const all = categories.data ?? [];
  const roots = all.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => all.filter((c) => c.parent_id === id);
  const countIn = (ids: string[]) =>
    (products.data ?? []).filter((p) => p.category_id && ids.includes(p.category_id)).length;

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{t("categories")}</h1>

      {categories.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}

      <div className="space-y-3">
        {roots.map((root) => {
          const kids = childrenOf(root.id);
          const total = countIn([root.id, ...kids.map((k) => k.id)]);
          return (
            <section key={root.id} className="overflow-hidden rounded-2xl border bg-card">
              <Link
                to="/search"
                search={{ cat: root.id }}
                className="flex items-center gap-3 p-4 hover:bg-sand"
              >
                <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sand">
                  {root.image_url ? (
                    <img src={root.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-primary">
                      {localized(lang, root.name_ar, root.name_en).charAt(0)}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold">
                    {localized(lang, root.name_ar, root.name_en)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {total} {t("products")}
                  </span>
                </span>
                <ChevronLeft className="size-5 shrink-0 text-muted-foreground ltr:rotate-180" />
              </Link>

              {kids.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t p-4">
                  {kids.map((k) => (
                    <Link
                      key={k.id}
                      to="/search"
                      search={{ cat: k.id }}
                      className="rounded-full bg-sand px-3 py-1.5 text-xs font-medium hover:bg-primary-soft"
                    >
                      {localized(lang, k.name_ar, k.name_en)}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {!categories.isLoading && roots.length === 0 && (
        <p className="py-16 text-center text-sm text-muted-foreground">{t("noProducts")}</p>
      )}
    </div>
  );
}
