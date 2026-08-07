import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { ORDER_STATUSES, formatIQD, statusLabel } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { cancelOrder } from "@/lib/orders.functions";
import { myOrdersQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "طلباتي | SmartTech" },
      { name: "description", content: "تابع حالة طلباتك: مراجعة، تجهيز، إرسال، إكتمال." },
      { property: "og:title", content: "طلباتي | SmartTech" },
      { property: "og:description", content: "تتبع طلباتك ومعرفة حالتها بالتفصيل." },
    ],
  }),
  component: OrdersPage,
});

function Tracker({ status }: { status: string }) {
  const { lang } = useLang();
  if (status === "cancelled") {
    return (
      <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
        {statusLabel(status, lang)}
      </p>
    );
  }
  const idx = ORDER_STATUSES.indexOf(status as (typeof ORDER_STATUSES)[number]);
  return (
    <ol className="flex items-center">
      {ORDER_STATUSES.map((s, i) => {
        const done = i <= idx;
        return (
          <li key={s} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border-2 text-[11px] font-bold",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-[10px] font-medium",
                  done ? "text-primary" : "text-muted-foreground",
                )}
              >
                {statusLabel(s, lang)}
              </span>
            </div>
            {i < ORDER_STATUSES.length - 1 && (
              <span
                className={cn("mx-1 mb-4 h-0.5 flex-1", i < idx ? "bg-primary" : "bg-border")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function OrdersPage() {
  const { lang, t } = useLang();
  const { user, loading } = useAuth();
  const { data, isLoading } = useQuery(myOrdersQuery(user?.id));
  const queryClient = useQueryClient();
  const cancel = useServerFn(cancelOrder);
  const resolve = useServerFn(resolveOrderIssue);
  const [busyId, setBusyId] = useState<string | null>(null);

  const onResolve = async (id: string, action: "continue" | "change"): Promise<void> => {
    setBusyId(id);
    try {
      await resolve({ data: { order_id: id, action } });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(t("actionSaved"));
    } catch {
      toast.error(t("error"));
    } finally {
      setBusyId(null);
    }
  };


  const onCancel = async (id: string): Promise<void> => {
    if (!window.confirm(t("cancelOrderConfirm"))) return;
    setBusyId(id);
    try {
      await cancel({ data: { order_id: id } });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(t("orderCancelled"));
    } catch (err) {
      const msg = err instanceof Error && err.message.includes("CANNOT_CANCEL") ? t("cannotCancel") : t("error");
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };


  if (!loading && !user) {
    return (
      <div className="py-20 text-center">
        <p className="text-base font-semibold">{t("loginRequired")}</p>
        <Link
          to="/account"
          className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          {t("signIn")}
        </Link>
      </div>
    );
  }

  const orders = (data ?? []) as Array<Record<string, any>>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t("orders")}</h1>

      {(loading || isLoading) &&
        Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
        ))}

      {!isLoading && orders.length === 0 && (
        <p className="py-16 text-center text-sm text-muted-foreground">{t("noOrders")}</p>
      )}

      {orders.map((o) => (
        <article key={o["id"]} className="space-y-4 rounded-2xl border bg-card p-4">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">
              {t("orderNo")} #{o["order_number"]}
            </h2>
            <span className="text-xs text-muted-foreground">
              {new Date(o["created_at"]).toLocaleDateString(lang === "ar" ? "ar-IQ-u-nu-latn" : "en-GB")}
            </span>
          </header>

          <Tracker status={o["status"]} />

          <ul className="space-y-1 border-t pt-3 text-sm">
            {(o["order_items"] ?? []).map((it: Record<string, any>) => (
              <li
                key={it["id"]}
                className={cn(
                  "flex justify-between gap-2",
                  it["is_unavailable"] && "text-muted-foreground line-through",
                )}
              >
                <span className="min-w-0 truncate">
                  {it["product_name"]} × {it["quantity"]}
                  {it["is_unavailable"] && (
                    <span className="ms-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive no-underline">
                      {t("unavailableItem")}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-medium">
                  {formatIQD(Number(it["unit_price"]) * Number(it["quantity"]), lang)}
                </span>
              </li>
            ))}
          </ul>

          {o["needs_customer_action"] && o["status"] === "review" && (
            <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-destructive">{t("orderNeedsAction")}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 rounded-full"
                  disabled={busyId === o["id"]}
                  onClick={() => void onResolve(String(o["id"]), "continue")}
                >
                  {t("continueOrder")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 rounded-full"
                  disabled={busyId === o["id"]}
                  onClick={() => void onResolve(String(o["id"]), "change")}
                >
                  {t("changeItem")}
                </Button>
              </div>
            </div>
          )}


          <dl className="space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t("shipping")}</dt>
              <dd>{formatIQD(Number(o["shipping_fee"]), lang)}</dd>
            </div>
            {Number(o["discount_amount"]) > 0 && (
              <div className="flex justify-between text-destructive">
                <dt>{t("discount")}</dt>
                <dd>-{formatIQD(Number(o["discount_amount"]), lang)}</dd>
              </div>
            )}
            <div className="flex justify-between text-base font-bold">
              <dt>{t("total")}</dt>
              <dd className="text-primary">{formatIQD(Number(o["total_amount"]), lang)}</dd>
            </div>
          </dl>

          {o["notes"] && (
            <p className="rounded-xl bg-sand p-3 text-sm">
              <span className="font-semibold">{t("adminNote")}: </span>
              {o["notes"]}
            </p>
          )}

          {o["status"] === "review" && (
            <Button
              variant="outline"
              className="w-full rounded-full border-destructive/40 text-destructive hover:bg-destructive/10"
              disabled={busyId === o["id"]}
              onClick={() => void onCancel(String(o["id"]))}
            >
              <XCircle className="size-4" />
              {t("cancelOrder")}
            </Button>
          )}

        </article>
      ))}
    </div>
  );
}
