import { createFileRoute } from "@tanstack/react-router";
import { Plus, RotateCcw, Settings2, Sun, Trash2 } from "lucide-react";
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
import { useLang } from "@/lib/i18n";

type Device = { id: number; name: string; watt: number; qty: number; hours: number };
type BatteryType = "lead" | "agm" | "lithium" | "custom";

const DOD: Record<Exclude<BatteryType, "custom">, number> = { lead: 50, agm: 60, lithium: 90 };

const DEFAULTS = {
  panelWatt: 550,
  sunHours: 4.5,
  batteryAh: 200,
  batteryVolt: 12,
  dod: 50,
  autonomy: 1,
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

  const [mode, setMode] = useState<"loads" | "amps">("loads");
  const [devices, setDevices] = useState<Device[]>([
    { id: 1, name: ar ? "ثلاجة" : "Fridge", watt: 150, qty: 1, hours: 12 },
    { id: 2, name: ar ? "إنارة LED" : "LED lights", watt: 15, qty: 8, hours: 6 },
  ]);

  // fixed amperage mode
  const [amps, setAmps] = useState(20);
  const [acVolt, setAcVolt] = useState(220);
  const [pf, setPf] = useState(0.9);
  const [ampHours, setAmpHours] = useState(6);

  // system settings
  const [panelWatt, setPanelWatt] = useState(DEFAULTS.panelWatt);
  const [sunHours, setSunHours] = useState(DEFAULTS.sunHours);
  const [batteryType, setBatteryType] = useState<BatteryType>("lead");
  const [batteryAh, setBatteryAh] = useState(DEFAULTS.batteryAh);
  const [batteryVolt, setBatteryVolt] = useState(DEFAULTS.batteryVolt);
  const [dod, setDod] = useState(DEFAULTS.dod);
  const [autonomy, setAutonomy] = useState(DEFAULTS.autonomy);
  const [inverterMode, setInverterMode] = useState<"auto" | "manual">("auto");
  const [inverterManual, setInverterManual] = useState(5);

  const update = (id: number, patch: Partial<Device>) =>
    setDevices((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const setBattery = (type: BatteryType) => {
    setBatteryType(type);
    if (type !== "custom") setDod(DOD[type]);
    if (type === "lithium") setBatteryVolt(51.2);
    else if (batteryVolt === 51.2) setBatteryVolt(12);
  };

  const resetDefaults = () => {
    setPanelWatt(DEFAULTS.panelWatt);
    setSunHours(DEFAULTS.sunHours);
    setBatteryType("lead");
    setBatteryAh(DEFAULTS.batteryAh);
    setBatteryVolt(DEFAULTS.batteryVolt);
    setDod(DEFAULTS.dod);
    setAutonomy(DEFAULTS.autonomy);
    setInverterMode("auto");
  };

  const peakW =
    mode === "loads"
      ? devices.reduce((s, d) => s + d.watt * d.qty, 0)
      : amps * acVolt * pf;
  const dailyWh =
    mode === "loads"
      ? devices.reduce((s, d) => s + d.watt * d.qty * d.hours, 0)
      : peakW * ampHours;

  const panelDen = (panelWatt || 1) * (sunHours || 1) * 0.8;
  const panels = Math.ceil(dailyWh / panelDen) || 0;
  const battWh = (batteryAh || 1) * (batteryVolt || 1) * ((dod || 50) / 100);
  const batteries = Math.ceil((dailyWh * (autonomy || 1)) / battWh) || 0;
  const autoInverterKw = Math.max(1, Math.ceil((peakW * 1.3) / 1000));
  const inverterKw = inverterMode === "auto" ? autoInverterKw : inverterManual || 0;
  const inverterOk = inverterKw * 1000 >= peakW * 1.1;

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
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border bg-card p-3 sm:grid-cols-4">
          <Field label={t("ampsLabel")}>
            <NumberField value={amps} onValueChange={(v) => setAmps(v ?? 0)} />
          </Field>
          <Field label={t("voltageLabel")}>
            <NumberField value={acVolt} onValueChange={(v) => setAcVolt(v ?? 0)} />
          </Field>
          <Field label={t("powerFactor")}>
            <NumberField value={pf} onValueChange={(v) => setPf(v ?? 1)} />
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
          <div className="col-span-2">
            <Field label={t("batteryType")}>
              <Select value={batteryType} onValueChange={(v) => setBattery(v as BatteryType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">{t("batteryLead")}</SelectItem>
                  <SelectItem value="agm">{t("batteryAgm")}</SelectItem>
                  <SelectItem value="lithium">{t("batteryLithium")}</SelectItem>
                  <SelectItem value="custom">{t("batteryCustom")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label={t("batteryAh")}>
            <NumberField value={batteryAh} onValueChange={(v) => setBatteryAh(v ?? 0)} />
          </Field>
          <Field label={t("batteryVolt")}>
            <NumberField value={batteryVolt} onValueChange={(v) => setBatteryVolt(v ?? 0)} />
          </Field>
          <Field label={t("dodLabel")}>
            <NumberField
              value={dod}
              onValueChange={(v) => {
                setDod(v ?? 0);
                setBatteryType("custom");
              }}
            />
          </Field>
          <Field label={t("autonomyDays")}>
            <NumberField value={autonomy} onValueChange={(v) => setAutonomy(v ?? 1)} />
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
              <NumberField
                value={inverterManual}
                onValueChange={(v) => setInverterManual(v ?? 0)}
              />
            </Field>
          )}
        </div>
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

      <p
        className={`mt-3 text-xs font-medium ${inverterOk ? "text-primary" : "text-destructive"}`}
      >
        {inverterOk ? t("inverterOk") : t("inverterLow")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{t("solarNote")}</p>
    </div>
  );
}
