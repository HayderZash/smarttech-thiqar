import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { localized, useLang } from "@/lib/i18n";

export type NewsItem = {
  id: string;
  image_url: string;
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
  link_url: string | null;
};

/** Auto-rotating news / promo strip managed from the admin panel. */
export function NewsCarousel({ items }: { items: NewsItem[] }) {
  const { lang } = useLang();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), 5000);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;
  const active = items[Math.min(index, items.length - 1)];
  if (!active) return null;

  const open = (url: string | null) => {
    if (!url) return;
    if (url.startsWith("/")) void navigate({ to: url as never });
    else window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <section aria-label="آخر الأخبار" className="overflow-hidden rounded-2xl border bg-card">
      <button
        type="button"
        onClick={() => open(active.link_url)}
        className="block w-full text-start"
        disabled={!active.link_url}
      >
        <span className="relative block aspect-[16/7] w-full overflow-hidden bg-sand">
          <img
            src={active.image_url}
            alt={localized(lang, active.title_ar, active.title_en)}
            className="h-full w-full object-cover transition-opacity duration-500"
          />
        </span>
        <span className="block p-4">
          <span className="block text-sm font-bold">
            {localized(lang, active.title_ar, active.title_en)}
          </span>
          {(active.description_ar || active.description_en) && (
            <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
              {localized(lang, active.description_ar, active.description_en)}
            </span>
          )}
        </span>
      </button>

      {items.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pb-3">
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              aria-label={`الخبر ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
