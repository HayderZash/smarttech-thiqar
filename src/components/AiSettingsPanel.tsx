import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const PROVIDERS = [
  { value: "gemini", label: "Google Gemini 2.5 Flash" },
  { value: "groq", label: "Groq" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "siliconflow", label: "SiliconFlow" },
  { value: "mistral", label: "Mistral" },
];

const KEY_FIELDS = [
  { key: "api_key_gemini", label: "مفتاح Google Gemini" },
  { key: "api_key_groq", label: "مفتاح Groq" },
  { key: "api_key_openrouter", label: "مفتاح OpenRouter" },
  { key: "api_key_siliconflow", label: "مفتاح SiliconFlow" },
  { key: "api_key_mistral", label: "مفتاح Mistral" },
];

/** Admin panel for the AI assistant provider, keys and behaviour. */
export function AiSettingsPanel() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const cfg = useQuery({
    queryKey: ["ai_settings"],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.from("ai_settings").select("key, value");
      if (error) throw error;
      return Object.fromEntries(
        ((data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]),
      );
    },
  });

  const value = (key: string) => draft[key] ?? cfg.data?.[key] ?? "";
  const set = (key: string, v: string) => setDraft((d) => ({ ...d, [key]: v }));

  const save = async () => {
    const rows = Object.entries(draft).map(([key, v]) => ({ key, value: v }));
    if (!rows.length) return;
    setBusy(true);
    const { error } = await supabase.from("ai_settings").upsert(rows);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft({});
    await qc.invalidateQueries({ queryKey: ["ai_settings"] });
    toast.success("تم حفظ إعدادات الذكاء الاصطناعي");
  };

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold">المساعد الذكي (الذكاء الاصطناعي)</h3>
        <p className="text-xs text-muted-foreground">
          يختار المزوّد ومفاتيح الـ APIs — المساعد يبحث في منتجات المتجر ويرسلها للزبون مع روابطها.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>المزوّد</Label>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={value("provider") || "gemini"}
            onChange={(e) => set("provider", e.target.value)}
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>اسم النموذج (اختياري)</Label>
          <Input
            dir="ltr"
            placeholder="gemini-2.5-flash"
            value={value("model")}
            onChange={(e) => set("model", e.target.value.trim())}
          />
        </div>

        {KEY_FIELDS.map((f) => (
          <div key={f.key} className="space-y-2">
            <Label>{f.label}</Label>
            <Input
              dir="ltr"
              type="password"
              placeholder="••••••"
              value={value(f.key)}
              onChange={(e) => set(f.key, e.target.value.trim())}
            />
          </div>
        ))}

        <div className="space-y-2">
          <Label>التبديل التلقائي بين المزودات عند الفشل</Label>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={value("fallback_enabled") || "1"}
            onChange={(e) => set("fallback_enabled", e.target.value)}
          >
            <option value="1">مفعّل (يجرّب كل المفاتيح المتوفرة)</option>
            <option value="0">معطّل (المزوّد المحدد فقط)</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label>ترتيب المودلات البديلة (اختياري)</Label>
          <Textarea
            dir="ltr"
            rows={3}
            value={value("model_fallbacks")}
            onChange={(e) => set("model_fallbacks", e.target.value)}
            placeholder={"gemini:gemini-2.5-flash\ngroq:llama-3.3-70b-versatile\nopenrouter:google/gemini-2.5-flash"}
          />
          <p className="text-[11px] text-muted-foreground">
            سطر لكل مودل بصيغة provider:model — عند فشل أو انتهاء صلاحية مودل ينتقل تلقائياً للتالي.
          </p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>تعليمات إضافية للمساعد</Label>
          <Textarea
            rows={3}
            value={value("system_prompt")}
            onChange={(e) => set("system_prompt", e.target.value)}
            placeholder="مثال: تحدث بلهجة عراقية بسيطة واقترح دائماً بدائل متوفرة."
          />
        </div>


        <div className="space-y-2 sm:col-span-2">
          <Label>الكلمة السرية لدالة Netlify (AI_PROXY_SECRET)</Label>
          <Input
            dir="ltr"
            value={value("proxy_secret")}
            onChange={(e) => set("proxy_secret", e.target.value.trim())}
          />
        </div>
      </div>

      <Button
        className="w-full"
        disabled={busy || Object.keys(draft).length === 0}
        onClick={() => void save()}
      >
        حفظ إعدادات الذكاء الاصطناعي
      </Button>
    </section>
  );
}
