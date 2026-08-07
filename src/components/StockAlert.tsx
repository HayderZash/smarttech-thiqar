import { BellRing } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toLatinDigits } from "@/lib/format";
import { useLang } from "@/lib/i18n";

export function StockAlert({ productId }: { productId: string }) {
  const { t } = useLang();
  const { profile } = useAuth();
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const clean = toLatinDigits(phone).replace(/\D/g, "");
    if (clean.length < 10) {
      toast.error(t("invalidPhone"));
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("stock_alerts").insert({ product_id: productId, phone: clean });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("notifySaved"));
  }

  return (
    <div className="rounded-2xl border border-dashed bg-sand p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <BellRing className="size-4 text-primary" />
        {t("notifyMe")}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{t("notifyMeDesc")}</p>
      <div className="flex gap-2">
        <Input
          value={phone}
          inputMode="tel"
          dir="ltr"
          onChange={(e) => setPhone(toLatinDigits(e.target.value))}
          placeholder="07XXXXXXXXX"
        />
        <Button onClick={submit} disabled={busy} className="rounded-full">
          {t("notifyMe")}
        </Button>
      </div>
    </div>
  );
}
