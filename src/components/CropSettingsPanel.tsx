import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { DEFAULT_CROP, cropStyle, useCropSettings } from "@/components/ProductImage";
import { supabase } from "@/integrations/supabase/client";

const SIZES = [
  { label: "موبايل", w: 150 },
  { label: "تابلت", w: 200 },
  { label: "ديسكتوب", w: 260 },
];

export function CropSettingsPanel() {
  const saved = useCropSettings();
  const qc = useQueryClient();
  const [crop, setCrop] = useState(saved);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCrop(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.zoom, saved.x, saved.y]);

  const sample = useQuery({
    queryKey: ["crop-sample-product"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("image_url")
        .not("image_url", "is", null)
        .limit(1);
      return data?.[0]?.image_url ?? "";
    },
  });

  const [preview, setPreview] = useState("");
  const src = preview || sample.data || "";

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("store_settings").upsert([
      { key: "img_crop_zoom", value: String(crop.zoom) },
      { key: "img_crop_x", value: String(crop.x) },
      { key: "img_crop_y", value: String(crop.y) },
    ]);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      qc.invalidateQueries({ queryKey: ["store_settings"] });
      toast.success("تم حفظ إعدادات قص الصور");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">قص صور المنتجات (يطبّق على جميع الصور)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-4">
          <Field
            label={`نسبة التكبير/القص: ${crop.zoom}%`}
            value={crop.zoom}
            min={100}
            max={260}
            onChange={(v) => setCrop({ ...crop, zoom: v })}
          />
          <Field
            label={`الإزاحة الأفقية: ${crop.x}%`}
            value={crop.x}
            min={0}
            max={100}
            onChange={(v) => setCrop({ ...crop, x: v })}
          />
          <Field
            label={`الإزاحة العمودية: ${crop.y}%`}
            value={crop.y}
            min={0}
            max={100}
            onChange={(v) => setCrop({ ...crop, y: v })}
          />
        </div>

        <div className="space-y-2">
          <Label>رابط صورة للمعاينة (اختياري)</Label>
          <Input dir="ltr" value={preview} onChange={(e) => setPreview(e.target.value)} placeholder="https://..." />
        </div>

        <div className="flex flex-wrap items-end gap-4">
          {SIZES.map((s) => (
            <div key={s.label} className="space-y-1">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <div
                className="relative overflow-hidden rounded-2xl border bg-sand"
                style={{ width: s.w, height: s.w }}
              >
                {src ? (
                  <img src={src} alt="معاينة القص" style={cropStyle(crop)} />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    لا توجد صورة
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? "جارٍ الحفظ..." : "حفظ إعدادات القص"}
          </Button>
          <Button variant="outline" onClick={() => setCrop(DEFAULT_CROP)}>
            إعادة الافتراضي
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Slider
        dir="ltr"
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={(vals) => onChange(vals[0] ?? min)}
      />
    </div>
  );
}
