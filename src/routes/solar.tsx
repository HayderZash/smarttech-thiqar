import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileDown, Plus, RotateCcw, Settings2, Sun, Trash2 } from "lucide-react";
import { useState } from "react";

import { NumberField } from "@/components/NumberField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatIQD } from "@/lib/format";
import { localized, useLang } from "@/lib/i18n";
import { solarComponentsQuery, type SolarComponent } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Device = { id: number; name: string; watt: number; qty: number; hours: number };

/** LiFePO4 usable depth of discharge. */
const DOD = 0.9;
const AC_VOLT = 220;

const DEFAULTS = {
  panelWatt: 550,
  sunHours: 4.5,
  batteryAh: 200,
  batteryVolt: 51.2,
};

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SolarPage() {
  const { t, lang } = useLang();
  const ar = lang === "ar";
  const components = useQuery(solarComponentsQuery);

  const [mode, setMode] = useState<"loads" | "amps">("loads");
  const [devices, setDevices] = useState<Device[]>([
    { id: 1, name: ar ? "ثلاجة" : "Fridge", watt: 150, qty: 1, hours: 12 },
    { id: 2, name: ar ? "إنارة LED" : "LED lights", watt: 15, qty: 8, hours: 6 },
  ]);

  // fixed amperage mode
  const [amps, setAmps] = useState(20);
  const [ampHours, setAmpHours] = useState(6);

  // system settings
  const [panelWatt, setPanelWatt] = useState(DEFAULTS.panelWatt);
  const [sunHours, setSunHours] = useState(DEFAULTS.sunHours);
  const [batteryAh, setBatteryAh] = useState(DEFAULTS.batteryAh);
  const [batteryVolt, setBatteryVolt] = useState(DEFAULTS.batteryVolt);
  const [inverterMode, setInverterMode] = useState<"auto" | "manual">("auto");
  const [inverterManual, setInverterManual] = useState(5);

  const [tier, setTier] = useState<"economy" | "mid" | "pro">("economy");
  const [picked, setPicked] = useState<Record<string, string>>({});

  const update = (id: number, patch: Partial<Device>) =>
    setDevices((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const resetDefaults = () => {
    setPanelWatt(DEFAULTS.panelWatt);
    setSunHours(DEFAULTS.sunHours);
    setBatteryAh(DEFAULTS.batteryAh);
    setBatteryVolt(DEFAULTS.batteryVolt);
    setInverterMode("auto");
  };

  const peakW =
    mode === "loads" ? devices.reduce((s, d) => s + d.watt * d.qty, 0) : amps * AC_VOLT;
  const dailyWh =
    mode === "loads" ? devices.reduce((s, d) => s + d.watt * d.qty * d.hours, 0) : peakW * ampHours;

  const panelDen = (panelWatt || 1) * (sunHours || 1) * 0.8;
  const panels = Math.ceil(dailyWh / panelDen) || 0;
  const battWh = (batteryAh || 1) * (batteryVolt || 1) * DOD;
  const batteries = Math.ceil(dailyWh / battWh) || 0;
  const autoInverterKw = Math.max(1, Math.ceil((peakW * 1.3) / 1000));
  const inverterKw = inverterMode === "auto" ? autoInverterKw : inverterManual || 0;
  const inverterOk = inverterKw * 1000 >= peakW * 1.1;

  // ---- catalog suggestions -------------------------------------------------
  const all = components.data ?? [];
  const qtyFor = (c: SolarComponent) => {
    if (c.kind === "panel") {
      const den = (c.capacity || 1) * (sunHours || 1) * 0.8;
      return Math.max(1, Math.ceil(dailyWh / den) || 1);
    }
    if (c.kind === "battery") {
      const wh = (c.capacity || 1) * (c.voltage || 12) * DOD;
      return Math.max(1, Math.ceil(dailyWh / wh) || 1);
    }
    return Math.max(1, Math.ceil((peakW * 1.3) / 1000 / (c.capacity || 1)) || 1);
  };

  const tiers = (["economy", "mid", "pro"] as const).filter((tr) =>
    all.some((c) => c.tier === tr),
  );
  const activeTier = tiers.includes(tier) ? tier : tiers[0];

  const groups = (["panel", "battery", "inverter"] as const).map((kind) => {
    const items = all
      .filter((c) => c.kind === kind && c.tier === activeTier)
      .map((c) => {
        const qty = qtyFor(c);
        return { c, qty, cost: qty * Number(c.price) };
      })
      .sort((a, b) => a.cost - b.cost);
    const selected = items.find((i) => i.c.id === picked[`${activeTier}:${kind}`]) ?? items[0];
    return { kind, items, selected };
  });

  const total = groups.reduce((s, g) => s + (g.selected?.cost ?? 0), 0);
  const hasCatalog = all.length > 0;
  const groupLabel: Record<string, string> = {
    panel: t("panelsGroup"),
    battery: t("batteriesGroup"),
    inverter: t("invertersGroup"),
  };
  const tierLabel: Record<string, string> = {
    economy: t("packageEconomy"),
    mid: t("packageMid"),
    pro: t("packagePro"),
  };

  const tierTotal = (tr: string) =>
    (["panel", "battery", "inverter"] as const).reduce((sum, kind) => {
      const best = all
        .filter((c) => c.kind === kind && c.tier === tr)
        .map((c) => qtyFor(c) * Number(c.price))
        .sort((a, b) => a - b)[0];
      return sum + (best ?? 0);
    }, 0);

  const printQuote = () => {
    const rows = groups
      .filter((g) => g.selected)
      .map((g) => {
        const s = g.selected!;
        const name = [localized(lang, s.c.name_ar, s.c.name_en), s.c.brand].filter(Boolean).join(" — ");
        return `<tr><td>${groupLabel[g.kind]}</td><td>${name}</td><td dir="ltr">${s.qty}</td><td dir="ltr">${formatIQD(
          Number(s.c.price),
          lang,
        )}</td><td dir="ltr">${formatIQD(s.cost, lang)}</td></tr>`;
      })
      .join("");
    const html = `<!doctype html><html dir="${ar ? "rtl" : "ltr"}" lang="${lang}"><head><meta charset="utf-8">
<title>${t("quoteTitle")} - SmartTech</title><style>
body{font-family:system-ui,'Segoe UI',Tahoma,sans-serif;padding:28px;color:#14281d}
h1{font-size:20px;margin:0 0 4px}p{margin:2px 0;font-size:12px;color:#5b6b60}
table{width:100%;border-collapse:collapse;margin-top:18px;font-size:13px}
th,td{border:1px solid #cfe0d4;padding:8px;text-align:${ar ? "right" : "left"}}
th{background:#eaf3ec}tfoot td{font-weight:800;background:#f6f2e8}
</style></head><body>
<h1>${t("quoteTitle")} — SmartTech</h1>
<p>${t("quoteDate")}: ${new Date().toLocaleDateString("en-GB")}</p>
<p>${tierLabel[activeTier ?? "mid"] ?? ""} · ${t("dailyEnergy")}: ${(dailyWh / 1000).toFixed(2)} kWh · ${t(
      "peakLoad",
    )}: ${(peakW / 1000).toFixed(2)} kW</p>
<table><thead><tr><th>${localized(lang, "القسم", "Group")}</th><th>${t("itemName")}</th><th>${t(
      "qtyNeeded",
    )}</th><th>${t("unitPriceLabel")}</th><th>${t("lineTotal")}</th></tr></thead><tbody>${rows}</tbody>
<tfoot><tr><td colspan="4">${t("totalCost")}</td><td dir="ltr">${formatIQD(total, lang)}</td></tr></tfoot></table>

</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };


  return (
    <div className="mx-auto max-w-3xl pb-6">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Sun className="size-5 text-warning" />
        {t("solarCalc")}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("solarDesc")}</p>

      {/* mode switch */}
      <div className="mt-4 rounded-2xl border bg-card p-3">
        <p className="text-[11px] text-muted-foreground">{t("calcMode")}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["loads", "amps"] as const).map((m) => (
            <Button
              key={m}
              variant={mode === m ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setMode(m)}
            >
              {m === "loads" ? t("modeLoads") : t("modeAmps")}
            </Button>
          ))}
        </div>
      </div>

      {mode === "loads" ? (
        <div className="mt-4 space-y-3">
          {devices.map((d) => (
            <div
              key={d.id}
              className="grid grid-cols-2 gap-2 rounded-2xl border bg-card p-3 sm:grid-cols-5"
            >
              <label className="col-span-2 space-y-1 sm:col-span-2">
                <span className="text-[11px] text-muted-foreground">{t("deviceName")}</span>
                <Input value={d.name} onChange={(e) => update(d.id, { name: e.target.value })} />
              </label>
              <Field label={t("watt")}>
                <NumberField value={d.watt} onValueChange={(v) => update(d.id, { watt: v ?? 0 })} />
              </Field>
              <Field label={t("qtyLabel")}>
                <NumberField value={d.qty} onValueChange={(v) => update(d.id, { qty: v ?? 0 })} />
              </Field>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Field label={t("hoursPerDay")}>
                    <NumberField
                      value={d.hours}
                      onValueChange={(v) => update(d.id, { hours: v ?? 0 })}
                    />
                  </Field>
                </div>
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
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border bg-card p-3">
          <Field label={t("ampsLabel")}>
            <NumberField value={amps} onValueChange={(v) => setAmps(v ?? 0)} />
          </Field>
          <Field label={t("hoursPerDay")}>
            <NumberField value={ampHours} onValueChange={(v) => setAmpHours(v ?? 0)} />
          </Field>
        </div>
      )}

      {/* system settings */}
      <div className="mt-4 rounded-2xl border bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Settings2 className="size-4 text-primary" />
            {t("systemSettings")}
          </p>
          <Button variant="ghost" size="sm" className="rounded-full" onClick={resetDefaults}>
            <RotateCcw className="size-3.5" />
            {t("resetDefaults")}
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label={t("panelWatt")}>
            <NumberField value={panelWatt} onValueChange={(v) => setPanelWatt(v ?? 0)} />
          </Field>
          <Field label={t("sunHours")}>
            <NumberField value={sunHours} onValueChange={(v) => setSunHours(v ?? 0)} />
          </Field>
          <Field label={t("batteryAh")}>
            <NumberField value={batteryAh} onValueChange={(v) => setBatteryAh(v ?? 0)} />
          </Field>
          <Field label={t("batteryVolt")}>
            <NumberField value={batteryVolt} onValueChange={(v) => setBatteryVolt(v ?? 0)} />
          </Field>

          <div className="col-span-2">
            <Field label={t("inverterCapacity")}>
              <Select
                value={inverterMode}
                onValueChange={(v) => setInverterMode(v as "auto" | "manual")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{t("inverterAuto")}</SelectItem>
                  <SelectItem value="manual">{t("inverterManual")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          {inverterMode === "manual" && (
            <Field label={t("inverterManual")}>
              <NumberField value={inverterManual} onValueChange={(v) => setInverterManual(v ?? 0)} />
            </Field>
          )}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">{t("batteryLifepo4")}</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: t("dailyEnergy"), value: `${(dailyWh / 1000).toFixed(2)} kWh` },
          { label: t("peakLoad"), value: `${(peakW / 1000).toFixed(2)} kW` },
          { label: `${t("panelsNeeded")} (${panelWatt}W)`, value: String(panels) },
          {
            label: `${t("batteriesNeeded")} (${batteryAh}Ah/${batteryVolt}V)`,
            value: String(batteries),
          },
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

      <p className={`mt-3 text-xs font-medium ${inverterOk ? "text-primary" : "text-destructive"}`}>
        {inverterOk ? t("inverterOk") : t("inverterLow")}
      </p>

      {/* catalog suggestions */}
      <section className="mt-6 rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-bold">{t("suggestedSystem")}</h2>
        <p className="text-xs text-muted-foreground">{t("suggestedDesc")}</p>

        {!hasCatalog ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("noSolarComponents")}</p>
        ) : (
          <div className="mt-4 space-y-5">
            {/* package tabs */}
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${tiers.length}, minmax(0,1fr))` }}>
              {tiers.map((tr) => (
                <button
                  key={tr}
                  type="button"
                  onClick={() => setTier(tr)}
                  className={cn(
                    "rounded-xl border p-3 text-start transition",
                    activeTier === tr ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <span className="block text-xs font-bold">{tierLabel[tr]}</span>
                  <span className="mt-1 block text-sm font-extrabold text-primary">
                    {formatIQD(tierTotal(tr), lang)}
                  </span>
                </button>
              ))}
            </div>

            {groups.every((g) => g.items.length === 0) && (
              <p className="py-4 text-center text-sm text-muted-foreground">{t("packageEmpty")}</p>
            )}

            {groups.map((g) =>
              g.items.length === 0 ? null : (
                <div key={g.kind} className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">{groupLabel[g.kind]}</p>
                  {g.items.map((i) => (
                    <button
                      key={i.c.id}
                      type="button"
                      onClick={() =>
                        setPicked((p) => ({ ...p, [`${activeTier}:${g.kind}`]: i.c.id }))
                      }
                      className={cn(
                        "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 text-start transition",
                        g.selected?.c.id === i.c.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {localized(lang, i.c.name_ar, i.c.name_en)}
                          {i.c.brand ? ` — ${i.c.brand}` : ""}
                        </span>
                        <span className="block text-[11px] text-muted-foreground" dir="ltr">
                          {formatIQD(Number(i.c.price), lang)} ×{i.qty}
                        </span>
                      </span>
                      <span className="text-end">
                        <span className="block text-[11px] text-muted-foreground">
                          {t("qtyNeeded")}: {i.qty}
                        </span>
                        <span className="block text-sm font-bold text-primary">
                          {formatIQD(i.cost, lang)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ),
            )}

            <div className="flex items-center justify-between rounded-xl bg-sand p-4">
              <span className="text-sm font-semibold">{t("totalCost")}</span>
              <span className="text-lg font-extrabold text-primary">{formatIQD(total, lang)}</span>
            </div>

            <Button className="w-full rounded-full" onClick={printQuote} disabled={total <= 0}>
              <FileDown className="size-4" />
              {t("exportQuote")}
            </Button>
          </div>
        )}
      </section>


      <p className="mt-3 text-xs text-muted-foreground">{t("solarNote")}</p>
    </div>
  );
}
