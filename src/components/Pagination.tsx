import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toLatinDigits } from "@/lib/format";

function pageList(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(total - 1, page + 1);
  if (from > 2) out.push("…");
  for (let i = from; i <= to; i++) out.push(i);
  if (to < total - 1) out.push("…");
  out.push(total);
  return out;
}

export function Pagination({
  page,
  totalPages,
  onPage,
  className = "",
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  const go = (p: number) => {
    onPage(Math.min(Math.max(1, p), totalPages));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <nav className={`mt-6 flex flex-wrap items-center justify-center gap-1.5 ${className}`}>
      <Button
        variant="outline"
        size="icon"
        aria-label="السابق"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
      >
        <ChevronRight className="size-4 ltr:hidden" />
        <ChevronLeft className="size-4 rtl:hidden" />
      </Button>
      {pageList(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground">
            …
          </span>
        ) : (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="icon"
            aria-current={p === page ? "page" : undefined}
            onClick={() => go(p)}
          >
            <span dir="ltr">{toLatinDigits(String(p))}</span>
          </Button>
        ),
      )}
      <Button
        variant="outline"
        size="icon"
        aria-label="التالي"
        disabled={page >= totalPages}
        onClick={() => go(page + 1)}
      >
        <ChevronLeft className="size-4 ltr:hidden" />
        <ChevronRight className="size-4 rtl:hidden" />
      </Button>
    </nav>
  );
}
