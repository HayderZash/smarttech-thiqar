import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { notificationsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

/**
 * Shows a real device notification (system tray) through the service worker,
 * falling back to the in-page Notification API when no worker is available.
 */
async function pushToDevice(title: string, body: string): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        dir: "rtl",
        lang: "ar",
        tag: `notif-${Date.now()}`,
        data: { url: "/orders" },
      });
      return;
    }
    new Notification(title, { body, icon: "/icon-192.png" });
  } catch {
    /* some browsers restrict notifications — silently ignore */
  }
}


export function NotificationsBell() {
  const { user } = useAuth();
  const { lang, t } = useLang();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery(notificationsQuery(user?.id));
  const items = (data ?? []) as Notif[];
  const unread = items.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (!user?.id) return;
    if (typeof window !== "undefined") {
      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      }
      if ("Notification" in window && Notification.permission === "default") {
        void Notification.requestPermission();
      }
    }
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as Notif;
          void pushToDevice(row.title, row.body);

          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          void queryClient.invalidateQueries({ queryKey: ["orders"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const markAllRead = async (): Promise<void> => {
    if (!user?.id || unread === 0) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  if (!user) return null;

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) void markAllRead();
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0 rounded-full"
          aria-label={t("notifications")}
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute end-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unread}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side={lang === "ar" ? "left" : "right"} className="w-[88vw] max-w-sm p-0">
        <SheetHeader className="border-b p-4 text-start">
          <SheetTitle>{t("notifications")}</SheetTitle>
        </SheetHeader>
        <ul className="max-h-[80vh] space-y-2 overflow-y-auto p-3">
          {items.length === 0 && (
            <li className="py-10 text-center text-sm text-muted-foreground">{t("noNotifications")}</li>
          )}
          {items.map((n) => (
            <li
              key={n.id}
              className={cn("rounded-xl border p-3", !n.is_read && "border-primary/40 bg-primary-soft/40")}
            >
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {new Date(n.created_at).toLocaleString(lang === "ar" ? "ar-IQ-u-nu-latn" : "en-GB")}
              </p>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
