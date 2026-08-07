import type { Lang } from "@/lib/i18n";
import { localized } from "@/lib/i18n";

export type CatLike = {
  id: string;
  parent_id: string | null;
  name_ar: string;
  name_en: string;
};

export function categoryChain(cats: CatLike[], id: string | null): CatLike[] {
  if (!id) return [];
  const c = cats.find((x) => x.id === id);
  if (!c) return [];
  const parent = c.parent_id ? cats.find((x) => x.id === c.parent_id) : undefined;
  return parent ? [parent, c] : [c];
}

export function categoryPathLabel(lang: Lang, cats: CatLike[], id: string | null): string {
  const chain = categoryChain(cats, id);
  const general = lang === "ar" ? "العام" : "General";
  if (chain.length === 0) return general;
  return chain.map((c) => localized(lang, c.name_ar, c.name_en)).join(" › ");
}
