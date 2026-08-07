import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type Category = { id: string; name_ar: string; name_en: string; parent_id: string | null };

const CONFIRM = "حذف";

export function BulkDeleteProducts({
  categories,
  counts,
  onDone,
}: {
  categories: Category[];
  /** productId counts keyed by category id, plus "none" and "all". */
  counts: Record<string, number>;
  onDone: () => void;
}) {
  const [target, setTarget] = useState<string>("none");
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);

  const count = counts[target] ?? 0;

  const run = async () => {
    if (word.trim() !== CONFIRM) {
      toast.error(`اكتب كلمة التأكيد «${CONFIRM}» أولاً`);
      return;
    }
    setBusy(true);
    try {
      let q = supabase.from("products").delete();
      if (target === "all") q = q.not("id", "is", null);
      else if (target === "none") q = q.is("category_id", null);
      else {
        const ids = [target, ...categories.filter((c) => c.parent_id === target).map((c) => c.id)];
        q = q.in("category_id", ids);
      }
      const { error } = await q;
      if (error) throw error;
      toast.success("تم حذف المنتجات المحددة");
      setWord("");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الحذف");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
      <h2 className="text-base font-bold text-destructive">حذف جماعي للمنتجات</h2>
      <p className="text-xs text-muted-foreground">
        اختر القسم المراد حذف منتجاته أو حذف كل المنتجات، ثم اكتب كلمة «{CONFIRM}» للتأكيد. لا يمكن
        التراجع عن هذه العملية.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-2">
          <Label>الهدف</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">العام (بدون قسم)</SelectItem>
              <SelectItem value="all">كل المنتجات</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name_ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>كلمة التأكيد</Label>
          <Input value={word} onChange={(e) => setWord(e.target.value)} placeholder={CONFIRM} />
        </div>
      </div>
      <Button variant="destructive" disabled={busy || word.trim() !== CONFIRM} onClick={run}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        حذف {count} منتج
      </Button>
    </div>
  );
}
