import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { LiveChat } from "@/components/LiveChat";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { allChatsQuery, type ChatMessage } from "@/lib/chat-queries";
import { whatsappLink } from "@/lib/format";
import { cn } from "@/lib/utils";

type Profile = { id: string; full_name: string; phone: string };

const profilesQueryKey = ["chat-profiles"];

/** Admin inbox: every customer conversation with live replies. */
export function ChatInbox() {
  const chats = useQuery(allChatsQuery);
  const profiles = useQuery({
    queryKey: profilesQueryKey,
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, phone");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
  const [active, setActive] = useState<string | null>(null);

  const threads = useMemo(() => {
    const byUser = new Map<string, { last: ChatMessage; unread: number }>();
    for (const m of chats.data ?? []) {
      const current = byUser.get(m.user_id);
      const unread = (current?.unread ?? 0) + (m.sender === "customer" && !m.is_read ? 1 : 0);
      byUser.set(m.user_id, { last: m, unread });
    }
    return [...byUser.entries()].sort(
      (a, b) => new Date(b[1].last.created_at).getTime() - new Date(a[1].last.created_at).getTime(),
    );
  }, [chats.data]);

  const nameOf = (id: string) => {
    const p = (profiles.data ?? []).find((x) => x.id === id);
    return { name: p?.full_name || "زبون", phone: p?.phone ?? "" };
  };

  if (active) {
    const info = nameOf(active);
    return (
      <div className="flex h-[70vh] flex-col rounded-2xl border">
        <div className="flex items-center justify-between gap-2 border-b p-2">
          <Button size="sm" variant="ghost" onClick={() => setActive(null)}>
            رجوع
          </Button>
          <p className="text-sm font-semibold">
            {info.name}
            {info.phone ? ` — ${info.phone}` : ""}
          </p>
          {info.phone && (
            <a
              href={whatsappLink(info.phone, `مرحباً ${info.name}، بخصوص رسالتك لمتجر SmartTech:`)}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border px-3 py-1.5 text-xs font-semibold"
            >
              واتساب
            </a>
          )}
        </div>
        <LiveChat userId={active} sender="admin" className="flex-1" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!threads.length && (
        <p className="py-6 text-center text-sm text-muted-foreground">لا توجد محادثات</p>
      )}
      {threads.map(([userId, t]) => {
        const info = nameOf(userId);
        return (
          <button
            key={userId}
            type="button"
            onClick={async () => {
              setActive(userId);
              await supabase
                .from("chat_messages")
                .update({ is_read: true })
                .eq("user_id", userId)
                .eq("sender", "customer")
                .eq("is_read", false);
            }}
            className={cn(
              "w-full rounded-2xl border p-3 text-start",
              t.unread > 0 && "border-primary/40 bg-primary-soft/40",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {info.name}
                {info.phone ? ` — ${info.phone}` : ""}
              </p>
              <span className="text-[11px] text-muted-foreground">
                {new Date(t.last.created_at).toLocaleString("ar-IQ-u-nu-latn")}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {t.last.body || (t.last.image_url ? "📷 صورة" : "")}
            </p>
            {t.unread > 0 && (
              <span className="mt-2 inline-flex rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                {t.unread} جديدة
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
