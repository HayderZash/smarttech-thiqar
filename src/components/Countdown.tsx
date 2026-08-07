import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

import { useLang } from "@/lib/i18n";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

export function Countdown({ endsAt }: { endsAt: string }) {
  const { t } = useLang();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(end) || end <= now) return null;
  const { d, h, m, s } = parts(end - now);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive">
      <Timer className="size-3.5" />
      {t("endsIn")}
      <span dir="ltr">
        {d > 0 ? `${d}d ` : ""}
        {pad(h)}:{pad(m)}:{pad(s)}
      </span>
    </span>
  );
}
