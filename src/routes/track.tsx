import { createFileRoute } from "@tanstack/react-router";
import { PackageSearch } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatIQD, statusLabel, toLatinDigits } from "@/lib/format";
import { useLang } from "@/lib/i18n";

type TrackResult = {
  order_number: number;
  status: string;
  total_amount: number;
  created_at: string;
  notes: string;
};

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "تتبّع الطلب | SmartTech" },
      { name: "description", content: "تتبّع حالة طلبك في SmartTech برقم الطلب ورقم الهاتف بدون تسجيل دخول." },
      { property: "og:title", content: "تتبّع الطلب | SmartTech" },
      { property: "og:description", content: "اعرف حالة طلبك خلال ثوانٍ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackPage,
});

function TrackPage() {
  const { t, lang } = useLang();
  const [orderNo, setOrderNo] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState("");

  async function search() {
    setBusy(true);
    setError("");
    setResult(null);
    const { data, error: err } = await supabase.rpc("track_order", {
      _order_number: Number(toLatinDigits(orderNo).replace(/\D/g, "")),
      _phone: toLatinDigits(phone).replace(/\D/g, ""),
    });
    setBusy(false);
    const row = Array.isArray(data) ? (data[0] as TrackResult | undefined) : undefined;
    if (err || !row) {
      setError(t("orderNotFound"));
      return;
    }
    setResult(row);
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <PackageSearch className="size-5 text-primary" />
        {t("trackOrder")}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("trackDesc")}</p>

      <div className="mt-4 space-y-3 rounded-2xl border bg-card p-4">
        <Input
          value={orderNo}
          dir="ltr"
          inputMode="numeric"
          placeholder={t("orderNo")}
          onChange={(e) => setOrderNo(toLatinDigits(e.target.value))}
        />
        <Input
          value={phone}
          dir="ltr"
          inputMode="tel"
          placeholder="07XXXXXXXXX"
          onChange={(e) => setPhone(toLatinDigits(e.target.value))}
        />
        <Button className="w-full rounded-full" disabled={busy} onClick={search}>
          {t("track")}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {result && (
        <div className="mt-4 space-y-2 rounded-2xl border bg-card p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("orderNo")}</span>
            <span className="font-bold" dir="ltr">
              #{result.order_number}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{lang === "ar" ? "الحالة" : "Status"}</span>
            <span className="font-semibold text-primary">{statusLabel(result.status, lang)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("total")}</span>
            <span className="font-bold">{formatIQD(Number(result.total_amount), lang)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{lang === "ar" ? "التاريخ" : "Date"}</span>
            <span>
              {new Date(result.created_at).toLocaleString(
                lang === "ar" ? "ar-IQ-u-nu-latn" : "en-GB",
              )}
            </span>
          </div>
          {result.notes && (
            <p className="rounded-xl bg-sand p-2 text-xs text-muted-foreground">{result.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}
