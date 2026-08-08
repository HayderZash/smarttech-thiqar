import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

const CONFIRM = "حذف";

export function DeleteOrderButton({
  orderId,
  orderNumber,
  onDone,
}: {
  orderId: string;
  orderNumber: number | string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (word.trim() !== CONFIRM) return;
    setBusy(true);
    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`تم حذف الطلب #${orderNumber}`);
    setOpen(false);
    setWord("");
    onDone();
  };

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
        حذف الطلب
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-2">
      <span className="text-xs text-muted-foreground">
        اكتب «{CONFIRM}» لتأكيد حذف الطلب نهائياً
      </span>
      <Input
        value={word}
        onChange={(e) => setWord(e.target.value)}
        placeholder={CONFIRM}
        className="h-8 w-24"
      />
      <Button size="sm" variant="destructive" disabled={busy || word.trim() !== CONFIRM} onClick={run}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        تأكيد
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setOpen(false);
          setWord("");
        }}
      >
        إلغاء
      </Button>
    </div>
  );
}
