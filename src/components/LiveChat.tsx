import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { myChatQuery, type ChatMessage } from "@/lib/chat-queries";
import { cn } from "@/lib/utils";

/** Uploads a chat image (private bucket, signed link) and returns url + path. */
async function uploadChatImage(file: File): Promise<{ url: string; path: string }> {
  if (file.size > 6 * 1024 * 1024) throw new Error("حجم الصورة كبير (الحد 6 ميغابايت)");
  const path = `chat/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await supabase.storage
    .from("store-media")
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (error) throw new Error(error.message);
  const { data, error: signErr } = await supabase.storage
    .from("store-media")
    .createSignedUrl(path, 60 * 60 * 24);
  if (signErr) throw new Error(signErr.message);
  return { url: data.signedUrl, path };
}

/** One conversation thread between a customer and the store admins. */
export function LiveChat({
  userId,
  sender,
  className,
}: {
  userId: string;
  sender: "customer" | "admin";
  className?: string;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(myChatQuery(userId));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const messages = (data ?? []) as ChatMessage[];

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `user_id=eq.${userId}` },
        () => {
          void qc.invalidateQueries({ queryKey: ["chat", userId] });
          void qc.invalidateQueries({ queryKey: ["chat-inbox"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  const send = async (image?: { url: string; path: string }) => {
    const body = text.trim();
    if (!body && !image) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("chat_messages").insert({
        user_id: userId,
        sender,
        body,
        image_url: image?.url ?? null,
        image_path: image?.path ?? null,
      });
      if (error) throw new Error(error.message);
      setText("");
      await qc.invalidateQueries({ queryKey: ["chat", userId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر الإرسال");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {isLoading && <p className="text-xs text-muted-foreground">جارِ التحميل...</p>}
        {!isLoading && !messages.length && (
          <p className="text-center text-xs text-muted-foreground">
            ابدأ المحادثة مع إدارة المتجر — يمكنك إرفاق صور أيضاً.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
              m.sender === sender
                ? "ms-auto bg-primary text-primary-foreground"
                : "me-auto bg-muted",
            )}
          >
            {m.image_url && (
              <img
                src={m.image_url}
                alt=""
                className="mb-1 max-h-48 rounded-xl object-cover"
                loading="lazy"
              />
            )}
            {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
            <p className="mt-1 text-[10px] opacity-70">
              {new Date(m.created_at).toLocaleString("ar-IQ-u-nu-latn")}
            </p>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex items-end gap-2 border-t p-2">
        <Button type="button" size="icon" variant="secondary" disabled={busy} asChild>
          <label className="cursor-pointer">
            <ImagePlus className="size-4" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                try {
                  const uploaded = await uploadChatImage(file);
                  await send(uploaded);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "تعذر رفع الصورة");
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
        </Button>
        <Textarea
          value={text}
          rows={1}
          maxLength={2000}
          placeholder="اكتب رسالتك..."
          onChange={(e) => setText(e.target.value)}
          className="min-h-10 flex-1 resize-none"
        />
        <Button size="icon" disabled={busy} onClick={() => void send()}>
          <Send className="size-4" />
        </Button>
      </div>
      <p className="px-3 pb-2 text-[10px] text-muted-foreground">
        الصور تُحذف تلقائياً بعد ٢٤ ساعة من الخادم.
      </p>
    </div>
  );
}
