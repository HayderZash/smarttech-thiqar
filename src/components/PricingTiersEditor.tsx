import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { NumberField } from "@/components/NumberField";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_PRICE_TIERS,
  applyPricing,
  formatIQD,
  parsePriceTiers,
  type PriceTier,
} from "@/lib/format";

const SAMPLES = [5000, 25000, 100000, 172000];

/**
 * Admin editor for the tiered (dynamic) pricing rules.
 * Rules are stored as JSON in store_settings.price_tiers.
 */
export function PricingTiersEditor({
  initialValue,
  legacyPercent,
  onChange,
}: {
  initialValue: string | undefined;
  legacyPercent: number;
  onChange: (json: string) => void;
}) {
  const [tiers, setTiers] = useState<PriceTier[]>(() =>
    parsePriceTiers(initialValue, legacyPercent),
  );

  const update = (next: PriceTier[]) => {
    setTiers(next);
    onChange(JSON.stringify(next));
  };

  const sorted = useMemo(
    () => [...tiers].sort((a, b) => (a.max ?? Infinity) - (b.max ?? Infinity)),
    [tiers],
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        كل شريحة تُطبَّق على المنتجات التي سعرها الأصلي أقل من أو يساوي الحد الأعلى. الشريحة
        الأخيرة (بدون حد) تُطبَّق على ما تبقّى. النتيجة تُقرَّب لأقرب 250 دينار ولا تنزل عن السعر
        الأصلي.
      </p>

      <div className="space-y-3">
        {tiers.map((t, i) => (
          <div
            key={i}
            className="grid gap-3 rounded-xl border bg-muted/30 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <div className="space-y-1">
              <Label className="text-xs">حتى سعر (اتركه فارغاً = بلا حد)</Label>
              <NumberField
                allowEmpty
                aria-label="الحد الأعلى للشريحة"
                placeholder="بلا حد"
                value={t.max}
                onValueChange={(v) =>
                  update(tiers.map((x, j) => (j === i ? { ...x, max: v } : x)))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">نسبة الزيادة (%)</Label>
              <NumberField
                aria-label="نسبة الزيادة"
                value={t.percent}
                onValueChange={(v) =>
                  update(tiers.map((x, j) => (j === i ? { ...x, percent: v ?? 0 } : x)))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">مبلغ ثابت يُضاف (د.ع)</Label>
              <NumberField
                aria-label="مبلغ ثابت"
                value={t.add}
                onValueChange={(v) =>
                  update(tiers.map((x, j) => (j === i ? { ...x, add: v ?? 0 } : x)))
                }
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="حذف الشريحة"
                disabled={tiers.length <= 1}
                onClick={() => update(tiers.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => update([...tiers, { max: null, percent: 0, add: 0 }])}
        >
          <Plus className="size-4" />
          إضافة شريحة
        </Button>
        <Button type="button" variant="outline" onClick={() => update([...DEFAULT_PRICE_TIERS])}>
          استعادة الشرائح الافتراضية
        </Button>
      </div>

      <div className="rounded-xl border p-3">
        <p className="mb-2 text-xs font-semibold">معاينة النتيجة</p>
        <div className="grid gap-1 text-xs sm:grid-cols-2">
          {SAMPLES.map((s) => {
            const out = applyPricing(s, sorted);
            const pct = s > 0 ? Math.round(((out - s) / s) * 1000) / 10 : 0;
            return (
              <div key={s} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{formatIQD(s)}</span>
                <span className="font-semibold">
                  {formatIQD(out)} <span dir="ltr">(+{pct}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
