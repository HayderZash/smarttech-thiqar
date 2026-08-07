import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { localized, useLang } from "@/lib/i18n";
import { categoriesQuery, productsQuery } from "@/lib/queries";

type Search = { cat?: string | undefined };

export const Route = createFileRoute("/categories")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    cat: typeof search["cat"] === "string" ? search["cat"] : undefined,
  }),

  head: () => ({
    meta: [
      { title: "الأقسام | SmartTech" },
      {
        name: "description",
        content: "تصفح أقسام المتجر: إلكترونيات، كهربائيات، طاقة شمسية، مواد بناء ومستلزمات عامة.",
      },
      { property: "og:title", content: "أقسام SmartTech" },
      { property: "og:description", content: "تصفح كل أقسام المتجر والمنتجات المتوفرة." },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { cat } = Route.useSearch();
  const { lang, t } = useLang();
  const categories = useQuery(categoriesQuery);
  const products = useQuery(productsQuery);

  const all = categories.data ?? [];
  const roots = all.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => all.filter((c) => c.parent_id === id);
  const productsIn = (ids: string[]) =>
    (products.data ?? []).filter((p) => p.category_id && ids.includes(p.category_id));

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{t("categories")}</h1>

      {categories.isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      )}

      <Accordion
        type="single"
        collapsible
        defaultValue={cat ?? roots[0]?.id ?? ""}
        className="space-y-3"
      >
        {roots.map((root) => {
          const kids = childrenOf(root.id);
          const list = productsIn([root.id, ...kids.map((k) => k.id)]);
          return (
            <AccordionItem
              key={root.id}
              value={root.id}
              className="overflow-hidden rounded-2xl border bg-card px-4"
            >
              <AccordionTrigger className="text-base font-semibold hover:no-underline">
                <span className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-sand">
                    {root.image_url ? (
                      <img src={root.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-bold text-primary">
                        {localized(lang, root.name_ar, root.name_en).charAt(0)}
                      </span>
                    )}
                  </span>
                  {localized(lang, root.name_ar, root.name_en)}
                  <span className="text-xs font-normal text-muted-foreground">({list.length})</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                {kids.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {kids.map((k) => (
                      <span
                        key={k.id}
                        className="rounded-full bg-sand px-3 py-1 text-xs font-medium"
                      >
                        {localized(lang, k.name_ar, k.name_en)}
                      </span>
                    ))}
                  </div>
                )}
                {list.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">{t("noProducts")}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {list.map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {!categories.isLoading && roots.length === 0 && (
        <p className="py-16 text-center text-sm text-muted-foreground">{t("noProducts")}</p>
      )}
    </div>
  );
}
