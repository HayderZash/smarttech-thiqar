import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";

import { ProductCard } from "@/components/ProductCard";
import { useLang } from "@/lib/i18n";
import { productsQuery } from "@/lib/queries";
import { useWishlist } from "@/lib/wishlist";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "المفضلة | SmartTech" },
      { name: "description", content: "قائمة المنتجات المفضلة لديك في متجر SmartTech." },
      { property: "og:title", content: "المفضلة | SmartTech" },
      { property: "og:description", content: "احفظ منتجاتك المفضلة وارجع إليها لاحقاً." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const { t } = useLang();
  const { ids } = useWishlist();
  const { data } = useQuery(productsQuery);
  const items = (data ?? []).filter((p) => ids.includes(p.id));

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-2 text-xl font-bold">
        <Heart className="size-5 text-destructive" />
        {t("wishlist")}
      </h1>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">{t("emptyWishlist")}</p>
          <Link to="/" className="mt-3 inline-block text-sm font-semibold text-primary">
            {t("home")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
