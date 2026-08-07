import { createFileRoute } from "@tanstack/react-router";
import { Plus, Sun, Trash2 } from "lucide-react";
import { useState } from "react";

import { NumberField } from "@/components/NumberField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/lib/i18n";

type Device = { id: number; name: string; watt: number; qty: number; hours: number };

export const Route = createFileRoute("/solar")({
  head: () => ({
    meta: [
      { title: "حاسبة الطاقة الشمسية | SmartTech" },
      {
        name: "description",
        content: "احسب عدد الألواح والبطاريات وقدرة الإنفرتر المناسبة لمنظومتك الشمسية في العراق.",
      },
      { property: "og:title", content: "حاسبة الطاقة الشمسية | SmartTech" },
      { property: "og:description", content: "أداة مجانية لتقدير حجم المنظومة الشمسية حسب أحمالك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SolarPage,
});

let nextId = 3;

function SolarPage() {
  const { t, lang } = useLang();
  const [devices, setDevices] = useState<Device[]>([
    { id: 1, name: lang === "ar" ? "ثلاجة" : "Fridge", watt: 150, qty: 1, hours: 12 },
    { id: 2, name: lang === "ar" ? "إنارة LED" : "LED lights", watt: 15, qty: 8, hours: 6 },
  ]);

  const update = (id: number, patch: Partial<Device>) =>
    setDevices((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const dailyWh = devices.reduce((s, d) => s + d.watt * d.qty * d.hours, 0);
  const peakW = devices.reduce((s, d) => s + d.watt * d.qty, 0);
  const panels = Math.ceil(dailyWh / (550 * 4.5)) || 0; // 4.5 peak sun hours
  const batteries = Math.ceil(dailyWh / (200 * 12 * 0.5)) || 0; // 50% DoD
  const inverterKw = Math.max(1, Math.ceil((peakW * 1.3) / 1000));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Sun className="size-5 text-warning" />
        {t("solarCalc")}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("solarDesc")}</p>

      <div className="mt-4 space-y-3">
        {devices.map((d) => (
          <div key={d.id} className="grid grid-cols-2 gap-2 rounded-2xl border bg-card p-3 sm:grid-cols-5">
            <label className="col-span-2 space-y-1 sm:col-span-2">
              <span className="text-[11px] text-muted-foreground">{t("deviceName")}</span>
              <Input value={d.name} onChange={(e) => update(d.id, { name: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground">{t("watt")}</span>
              <NumberField value={d.watt} onValueChange={(v) => update(d.id, { watt: v })} />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground">{t("qtyLabel")}</span>
              <NumberField value={d.qty} onValueChange={(v) => update(d.id, { qty: v })} />
            </label>
            <div className="flex items-end gap-2">
              <label className="flex-1 space-y-1">
                <span className="text-[11px] text-muted-foreground">{t("hoursPerDay")}</span>
                <NumberField value={d.hours} onValueChange={(v) => update(d.id, { hours: v })} />
              </label>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("remove")}
                onClick={() => setDevices((l) => l.filter((x) => x.id !== d.id))}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          className="rounded-full"
          onClick={() =>
            setDevices((l) => [...l, { id: nextId++, name: "", watt: 0, qty: 1, hours: 1 }])
          }
        >
          <Plus className="size-4" />
          {t("addDevice")}
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t("dailyEnergy"), value: `${(dailyWh / 1000).toFixed(2)} kWh` },
          { label: t("panelsNeeded"), value: String(panels) },
          { label: t("batteriesNeeded"), value: String(batteries) },
          { label: t("inverterNeeded"), value: `${inverterKw} kW` },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border bg-sand p-4">
            <p className="text-[11px] text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-xl font-extrabold text-primary" dir="ltr">
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{t("solarNote")}</p>
    </div>
  );
}
