import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { replySupportMessage } from "@/lib/support.functions";

/** Admin in-app reply box for one support message. */
export function SupportReply({
  id,
  currentReply,
}: {
  id: string;
  currentReply: string;
}) {
  const qc = useQueryClient();
  const reply = useServerFn(replySupportMessage);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const value = text.trim();
    if (!value) {
      toast.error("اكتب الرد أولاً");
      return;
    }
    setBusy(true);
    try {
      await reply({ data: { id, reply: value } });
      setText("");
      toast.success("تم إرسال الرد وإشعار الزبون");
      await qc.invalidateQueries({ queryKey: ["support-messages"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر إرسال الرد");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      {currentReply && (
        <div className="rounded-lg border border-primary/40 bg-primary-soft/30 p-2">
          <p className="text-[11px] font-semibold text-primary">ردك السابق</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{currentReply}</p>
        </div>
      )}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="اكتب ردك داخل التطبيق..."
      />
      <Button size="sm" className="rounded-full" disabled={busy} onClick={() => void send()}>
        <Send className="size-4" />
        إرسال الرد داخل التطبيق
      </Button>
    </div>
  );
}
