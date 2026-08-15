import { useQuery } from "@tanstack/react-query";
import { Bot, MessageCircle, X } from "lucide-react";
import { useState } from "react";

import { AiChat } from "@/components/AiChat";
import { LiveChat } from "@/components/LiveChat";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { whatsappLink } from "@/lib/format";
import { settingsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Panel = "chat" | "ai" | null;

/** Floating customer helpers: live chat with the store and an AI assistant. */
export function ChatWidget() {
  const { user } = useAuth();
  const settings = useQuery(settingsQuery);
  const [panel, setPanel] = useState<Panel>(null);
  const waPhone = settings.data?.["support_whatsapp"] ?? settings.data?.["store_phone"] ?? "";

  return (
    <>
      <div className="fixed bottom-24 end-4 z-40 flex flex-col items-center gap-2">
        <Button
          size="icon"
          variant="secondary"
          aria-label="مساعد ذكي"
          className="size-12 rounded-full border shadow-lg"
          onClick={() => setPanel(panel === "ai" ? null : "ai")}
        >
          <Bot className="size-5" />
        </Button>
        <Button
          size="icon"
          aria-label="محادثة مع الإدارة"
          className="size-12 rounded-full shadow-lg"
          onClick={() => setPanel(panel === "chat" ? null : "chat")}
        >
          <MessageCircle className="size-5" />
        </Button>
      </div>

      {panel && (
        <div
          className={cn(
            "fixed inset-x-2 bottom-20 z-50 flex h-[70vh] flex-col overflow-hidden rounded-3xl border bg-background shadow-2xl",
            "sm:inset-x-auto sm:end-4 sm:w-[380px]",
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <p className="text-sm font-semibold">
              {panel === "ai" ? "المساعد الذكي" : "محادثة مع إدارة المتجر"}
            </p>
            <div className="flex items-center gap-1">
              {panel === "chat" && waPhone && (
                <a
                  href={whatsappLink(waPhone, "مرحباً SmartTech، لدي استفسار:")}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-primary-soft px-3 py-1 text-[11px] font-semibold text-primary"
                >
                  واتساب
                </a>
              )}
              <Button size="icon" variant="ghost" aria-label="إغلاق" onClick={() => setPanel(null)}>
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {panel === "ai" ? (
            <AiChat />
          ) : user ? (
            <LiveChat userId={user.id} sender="customer" />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
              سجّل الدخول لبدء المحادثة مع إدارة المتجر.
            </div>
          )}
        </div>
      )}
    </>
  );
}
