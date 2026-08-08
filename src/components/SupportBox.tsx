import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LifeBuoy, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supportMessagesQuery } from "@/lib/queries";
import { sendSupportMessage } from "@/lib/support.functions";

/** Customer-facing support box: sends a message straight to the store admins. */
export function SupportBox() {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const send = useServerFn(sendSupportMessage);
  const mine = useQuery(supportMessagesQuery);

  const submit = async () => {
    const message = text.trim();
    if (message.length < 2) {
      toast.error("اكتب رسالتك أولاً");
      return;
    }
    setBusy(true);
    try {
      await send({ data: { message } });
      setText("");
      toast.success("تم إرسال رسالتك إلى الإدارة");
      await qc.invalidateQueries({ queryKey: ["support-messages"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر الإرسال");
    } finally {
      setBusy(false);
    }
  };

  const items = mine.data ?? [];

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <LifeBuoy className="size-4 text-primary" />
        الدعم والمساعدة
      </h2>
      <p className="text-xs text-muted-foreground">
        أرسل استفسارك أو مشكلتك وسيصل مباشرة إلى إدارة المتجر.
      </p>
      <div className="space-y-2">
        <Label htmlFor="support-msg">رسالتك</Label>
        <Textarea
          id="support-msg"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="اكتب رسالتك هنا..."
        />
      </div>
      <Button className="w-full rounded-full" disabled={busy} onClick={() => void submit()}>
        <Send className="size-4" />
        إرسال إلى الإدارة
      </Button>

      {items.length > 0 && (
        <ul className="space-y-2 border-t pt-3">
          <li className="text-xs font-semibold text-muted-foreground">رسائلي السابقة</li>
          {items.slice(0, 5).map((m) => (
            <li key={m.id} className="rounded-xl bg-sand p-3 text-sm">
              <p className="whitespace-pre-wrap">{m.message}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {new Date(m.created_at).toLocaleString("ar-IQ-u-nu-latn")} ·{" "}
                {m.admin_reply ? "تم الرد" : m.is_read ? "تمت القراءة" : "قيد المراجعة"}
              </p>
              {m.admin_reply && (
                <div className="mt-2 rounded-lg border border-primary/40 bg-card p-2">
                  <p className="text-[11px] font-semibold text-primary">رد الإدارة</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{m.admin_reply}</p>
                </div>
              )}
            </li>

          ))}
        </ul>
      )}
    </div>
  );
}
