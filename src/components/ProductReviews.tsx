import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { reviewsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function Stars({ value, size = "size-4" }: { value: number; size?: string }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(size, n <= value ? "fill-warning text-warning" : "text-muted-foreground/40")}
        />
      ))}
    </span>
  );
}

export function ProductReviews({ productId }: { productId: string }) {
  const { t, lang } = useLang();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery(reviewsQuery(productId));
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const approved = (data ?? []).filter((r) => r.is_approved);
  const avg = approved.length
    ? approved.reduce((s, r) => s + r.rating, 0) / approved.length
    : 0;

  async function submit() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("reviews").insert({
      product_id: productId,
      user_id: user.id,
      author_name: profile?.full_name || "",
      rating,
      comment: comment.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setComment("");
    setRating(5);
    toast.success(t("reviewPending"));
    void qc.invalidateQueries({ queryKey: ["reviews", productId] });
  }

  return (
    <section className="mt-9">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-lg font-bold">{t("reviews")}</h2>
        {approved.length > 0 && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Stars value={Math.round(avg)} />
            {avg.toFixed(1)} ({approved.length})
          </span>
        )}
      </div>

      <div className="space-y-3">
        {approved.length === 0 && <p className="text-sm text-muted-foreground">{t("noReviews")}</p>}
        {approved.map((r) => (
          <div key={r.id} className="rounded-2xl border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{r.author_name || "—"}</span>
              <Stars value={r.rating} />
            </div>
            {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
            <p className="mt-1 text-[11px] text-muted-foreground">
              {new Date(r.created_at).toLocaleDateString(
                lang === "ar" ? "ar-IQ-u-nu-latn" : "en-GB",
              )}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">{t("writeReview")}</h3>
        {user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("yourRating")}</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n}`}>
                  <Star
                    className={cn(
                      "size-6",
                      n <= rating ? "fill-warning text-warning" : "text-muted-foreground/40",
                    )}
                  />
                </button>
              ))}
            </div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("yourReview")}
              rows={3}
            />
            <Button onClick={submit} disabled={busy} className="rounded-full">
              {t("submitReview")}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("loginToReview")}</p>
        )}
      </div>
    </section>
  );
}
