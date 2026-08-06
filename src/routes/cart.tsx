import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Minus, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { formatIQD } from "@/lib/format";
import { localized, useLang } from "@/lib/i18n";
import { placeOrder, validateCoupon } from "@/lib/orders.functions";
import { governoratesQuery } from "@/lib/queries";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "السلة وإتمام الطلب | متجر النور" },
      { name: "description", content: "راجع سلتك واختر المحافظة وأكمل طلبك بالدفع عند الاستلام." },
      { property: "og:title", content: "السلة | متجر النور" },
      { property: "og:description", content: "أكمل طلبك واختر محافظتك لحساب أجور التوصيل." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { lang, t } = useLang();
  const { items, subtotal, setQty, remove, clear } = useCart();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { data: governorates } = useQuery(governoratesQuery);
  const submit = useServerFn(placeOrder);
  const checkCoupon = useServerFn(validateCoupon);

  const [govId, setGovId] = useState("");
  const [landmark, setLandmark] = useState("");
  const [time, setTime] = useState("");
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [busy, setBusy] = useState(false);

  const gov = (governorates ?? []).find((g) => g.id === govId);
  const shipping = Number(gov?.shipping_cost ?? 0);
  const total = Math.max(0, subtotal - discount) + shipping;

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-base font-semibold">{t("emptyCart")}</p>
        <Link
          to="/"
          className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          {t("startShopping")}
        </Link>
      </div>
    );
  }

  const onApplyCoupon = async () => {
    if (!user) return toast.error(t("loginRequired"));
    try {
      const res = await checkCoupon({ data: { code: coupon, subtotal } });
      if (res.valid) {
        setDiscount(res.discount);
        toast.success(t("saved"));
      } else {
        setDiscount(0);
        toast.error(t("error"));
      }
    } catch {
      toast.error(t("error"));
    }
  };

  const onCheckout = async () => {
    if (!user) {
      toast.error(t("loginRequired"));
      void navigate({ to: "/account" });
      return;
    }
    if (!govId) return toast.error(t("governorate"));
    if (landmark.trim().length < 2) return toast.error(t("landmark"));
    setBusy(true);
    try {
      const res = await submit({
        data: {
          items: items.map((i) => ({ product_id: i.id, quantity: i.quantity })),
          governorate_id: govId,
          landmark: landmark.trim(),
          preferred_delivery_time: time.trim(),
          coupon_code: coupon.trim() || null,
          full_name: profile?.full_name || "",
          phone: profile?.phone || "",
        },
      });
      clear();
      toast.success(`${t("orderPlaced")} #${res.order_number}`);
      void navigate({ to: "/orders" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        <h1 className="text-xl font-bold">{t("cart")}</h1>
        {items.map((i) => (
          <div key={i.id} className="flex gap-3 rounded-2xl border bg-card p-3">
            <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-sand">
              {i.image_url && (
                <img
                  src={i.image_url}
                  alt={localized(lang, i.name_ar, i.name_en)}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="line-clamp-2 text-sm font-semibold">
                {localized(lang, i.name_ar, i.name_en)}
              </p>
              <p className="text-sm font-bold text-primary">{formatIQD(i.price * i.quantity, lang)}</p>
              <div className="mt-auto flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-full border p-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-full"
                    aria-label="-"
                    onClick={() => setQty(i.id, i.quantity - 1)}
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <span className="w-6 text-center text-sm font-semibold">{i.quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-full"
                    aria-label="+"
                    onClick={() => setQty(i.id, i.quantity + 1)}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => remove(i.id)}
                >
                  <Trash2 className="size-4" />
                  {t("remove")}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4 rounded-2xl border bg-card p-4 lg:sticky lg:top-20 lg:self-start">
        <h2 className="text-base font-bold">{t("orderSummary")}</h2>

        <div className="space-y-2">
          <Label>{t("governorate")}</Label>
          <Select value={govId} onValueChange={setGovId}>
            <SelectTrigger>
              <SelectValue placeholder={t("governorate")} />
            </SelectTrigger>
            <SelectContent>
              {(governorates ?? []).map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {localized(lang, g.name_ar, g.name_en)} — {formatIQD(Number(g.shipping_cost), lang)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("landmark")}</Label>
          <Textarea
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
            maxLength={300}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label>
            {t("deliveryTime")} <span className="text-muted-foreground">({t("optional")})</span>
          </Label>
          <Input value={time} onChange={(e) => setTime(e.target.value)} maxLength={120} />
        </div>

        <div className="space-y-2">
          <Label>{t("coupon")}</Label>
          <div className="flex gap-2">
            <Input value={coupon} onChange={(e) => setCoupon(e.target.value)} maxLength={60} />
            <Button variant="secondary" onClick={() => void onApplyCoupon()}>
              {t("applyCoupon")}
            </Button>
          </div>
        </div>

        <dl className="space-y-1.5 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("subtotal")}</dt>
            <dd className="font-medium">{formatIQD(subtotal, lang)}</dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-destructive">
              <dt>{t("discount")}</dt>
              <dd>-{formatIQD(discount, lang)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("shipping")}</dt>
            <dd className="font-medium">{formatIQD(shipping, lang)}</dd>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <dt>{t("total")}</dt>
            <dd className="text-primary">{formatIQD(total, lang)}</dd>
          </div>
        </dl>

        <Button
          className="h-12 w-full rounded-full text-base"
          disabled={busy}
          onClick={() => void onCheckout()}
        >
          {user ? t("checkout") : t("loginRequired")}
        </Button>
      </div>
    </div>
  );
}
