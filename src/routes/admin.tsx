import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Trash2, Upload } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ORDER_STATUSES, formatIQD, statusLabel, whatsappLink } from "@/lib/format";
import { localized, useLang } from "@/lib/i18n";
import { bannersQuery, categoriesQuery, governoratesQuery, productsQuery, settingsQuery } from "@/lib/queries";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "لوحة الإدارة | SmartTech" },
      { name: "description", content: "إدارة المنتجات والأقسام والطلبات وإعدادات المتجر." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "لوحة الإدارة | SmartTech" },
      { property: "og:description", content: "إدارة المتجر بالكامل من مكان واحد." },
    ],
  }),
  component: AdminPage,
});

/** Uploads to the private store-media bucket and returns a long-lived signed URL. */
async function uploadMedia(file: File, folder: string) {
  const path = `${folder}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await supabase.storage.from("store-media").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data, error: signErr } = await supabase.storage
    .from("store-media")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (signErr) throw signErr;
  return data.signedUrl;
}

function FileField({
  label,
  accept,
  folder,
  value,
  onChange,
}: {
  label: string;
  accept: string;
  folder: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          dir="ltr"
        />
        <Button type="button" variant="secondary" size="icon" disabled={busy} asChild>
          <label className="cursor-pointer">
            <Upload className="size-4" />
            <input
              type="file"
              accept={accept}
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                try {
                  onChange(await uploadMedia(file, folder));
                  toast.success("تم الرفع");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "فشل الرفع");
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
        </Button>
      </div>
      {value && accept.startsWith("image") && (
        <img src={value} alt="" className="size-16 rounded-xl object-cover" />
      )}
    </div>
  );
}

const emptyProduct = {
  sku: "",
  name_ar: "",
  name_en: "",
  description_ar: "",
  description_en: "",
  price: 0,
  discount_price: null as number | null,
  category_id: null as string | null,
  image_url: "",
  catalog_pdf_url: "",
  stock_qty: 0,
  is_featured: false,
};

function AdminPage() {
  const { lang } = useLang();
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();

  const products = useQuery(productsQuery);
  const categories = useQuery(categoriesQuery);
  const governorates = useQuery(governoratesQuery);
  const banners = useQuery(bannersQuery);
  const settings = useQuery(settingsQuery);
  const orders = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(id, product_name, quantity, unit_price)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = (keys: string[]) =>
    keys.forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));

  const [pform, setPform] = useState({ ...emptyProduct });
  const [cform, setCform] = useState({ name_ar: "", name_en: "", image_url: "", parent_id: "" });
  const [bform, setBform] = useState({ image_url: "", title_ar: "", title_en: "", link_url: "" });
  const [couponForm, setCouponForm] = useState({ code: "", discount_type: "fixed", discount_value: 0 });
  const [store, setStore] = useState<Record<string, string>>({});

  const saveProduct = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").insert({
        ...pform,
        category_id: pform.category_id || null,
        discount_price: pform.discount_price || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPform({ ...emptyProduct });
      invalidate(["products"]);
      toast.success("تمت الإضافة");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;
  if (!isAdmin) {
    return (
      <div className="py-20 text-center">
        <p className="text-base font-semibold">هذه الصفحة مخصصة للإدارة فقط</p>
        <Link to="/account" className="mt-4 inline-block text-sm font-semibold text-primary">
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  const allOrders = (orders.data ?? []) as Array<Record<string, any>>;
  const revenue = allOrders
    .filter((o) => o["status"] !== "cancelled")
    .reduce((s, o) => s + Number(o["total_amount"]), 0);
  const pending = allOrders.filter((o) => o["status"] === "review").length;
  const lowStock = (products.data ?? []).filter((p) => p.stock_qty <= 2);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">لوحة الإدارة</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "الطلبات", value: allOrders.length },
          { label: "قيد المراجعة", value: pending },
          { label: "المنتجات", value: products.data?.length ?? 0 },
          { label: "المبيعات", value: formatIQD(revenue, lang) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-lg font-bold text-primary">{s.value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="orders">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="orders">الطلبات</TabsTrigger>
          <TabsTrigger value="products">المنتجات</TabsTrigger>
          <TabsTrigger value="categories">الأقسام</TabsTrigger>
          <TabsTrigger value="shipping">المحافظات</TabsTrigger>
          <TabsTrigger value="banners">البانرات</TabsTrigger>
          <TabsTrigger value="coupons">الكوبونات</TabsTrigger>
          <TabsTrigger value="settings">الإعدادات</TabsTrigger>
        </TabsList>

        {/* ORDERS */}
        <TabsContent value="orders" className="space-y-3">
          {allOrders.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">لا توجد طلبات</p>
          )}
          {allOrders.map((o) => (
            <div key={o["id"]} className="space-y-3 rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold">
                  #{o["order_number"]} — {o["customer_name"]}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {new Date(o["created_at"]).toLocaleString("ar-IQ")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {o["phone"]} · {o["governorate_name"]} · {o["landmark"]}
                {o["preferred_delivery_time"] ? ` · ${o["preferred_delivery_time"]}` : ""}
              </p>
              <ul className="text-sm">
                {(o["order_items"] ?? []).map((it: Record<string, any>) => (
                  <li key={it["id"]}>
                    • {it["product_name"]} × {it["quantity"]} —{" "}
                    {formatIQD(Number(it["unit_price"]) * Number(it["quantity"]), lang)}
                  </li>
                ))}
              </ul>
              <p className="font-bold text-primary">
                {formatIQD(Number(o["total_amount"]), lang)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (توصيل {formatIQD(Number(o["shipping_fee"]), lang)})
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={o["status"]}
                  onValueChange={async (status) => {
                    const { error } = await supabase
                      .from("orders")
                      .update({ status })
                      .eq("id", o["id"]);
                    if (error) toast.error(error.message);
                    else {
                      invalidate(["admin-orders", "orders"]);
                      toast.success("تم التحديث");
                    }
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...ORDER_STATUSES, "cancelled"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabel(s, lang)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="secondary" size="sm" asChild>
                  <a
                    href={whatsappLink(
                      o["phone"],
                      `مرحباً ${o["customer_name"]}، بخصوص طلبك رقم ${o["order_number"]}`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    واتساب
                  </a>
                </Button>
              </div>
              <Textarea
                defaultValue={o["notes"]}
                placeholder="ملاحظة تظهر للزبون"
                rows={2}
                onBlur={async (e) => {
                  if (e.target.value === o["notes"]) return;
                  const { error } = await supabase
                    .from("orders")
                    .update({ notes: e.target.value })
                    .eq("id", o["id"]);
                  if (error) toast.error(error.message);
                  else invalidate(["admin-orders", "orders"]);
                }}
              />
            </div>
          ))}
        </TabsContent>

        {/* PRODUCTS */}
        <TabsContent value="products" className="space-y-4">
          <div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
            <h2 className="text-base font-bold sm:col-span-2">إضافة منتج</h2>
            <div className="space-y-2">
              <Label>الاسم بالعربية</Label>
              <Input value={pform.name_ar} onChange={(e) => setPform({ ...pform, name_ar: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الاسم بالإنكليزية</Label>
              <Input value={pform.name_en} onChange={(e) => setPform({ ...pform, name_en: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الرمز SKU</Label>
              <Input value={pform.sku} onChange={(e) => setPform({ ...pform, sku: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>القسم</Label>
              <Select
                value={pform.category_id ?? ""}
                onValueChange={(v) => setPform({ ...pform, category_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  {(categories.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {localized(lang, c.name_ar, c.name_en)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>السعر</Label>
              <Input
                type="number"
                value={pform.price}
                onChange={(e) => setPform({ ...pform, price: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>سعر الخصم</Label>
              <Input
                type="number"
                value={pform.discount_price ?? ""}
                onChange={(e) =>
                  setPform({ ...pform, discount_price: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>الكمية</Label>
              <Input
                type="number"
                value={pform.stock_qty}
                onChange={(e) => setPform({ ...pform, stock_qty: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center gap-3 pt-7">
              <Switch
                checked={pform.is_featured}
                onCheckedChange={(v) => setPform({ ...pform, is_featured: v })}
                id="feat"
              />
              <Label htmlFor="feat">منتج مميز</Label>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>الوصف بالعربية</Label>
              <Textarea
                rows={3}
                value={pform.description_ar}
                onChange={(e) => setPform({ ...pform, description_ar: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>الوصف بالإنكليزية</Label>
              <Textarea
                rows={3}
                value={pform.description_en}
                onChange={(e) => setPform({ ...pform, description_en: e.target.value })}
              />
            </div>
            <FileField
              label="صورة المنتج"
              accept="image/*"
              folder="products"
              value={pform.image_url}
              onChange={(url) => setPform({ ...pform, image_url: url })}
            />
            <FileField
              label="الكتالوج الفني PDF"
              accept="application/pdf"
              folder="catalogs"
              value={pform.catalog_pdf_url}
              onChange={(url) => setPform({ ...pform, catalog_pdf_url: url })}
            />
            <Button
              className="sm:col-span-2"
              disabled={saveProduct.isPending || !pform.name_ar}
              onClick={() => saveProduct.mutate()}
            >
              <Plus className="size-4" /> إضافة المنتج
            </Button>
          </div>

          {lowStock.length > 0 && (
            <div className="rounded-2xl border border-warning bg-warning/10 p-3 text-sm">
              <p className="font-semibold">تنبيه انخفاض المخزون:</p>
              {lowStock.map((p) => (
                <span key={p.id} className="me-2">
                  {p.name_ar} ({p.stock_qty})
                </span>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {(products.data ?? []).map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-sand">
                  {p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name_ar}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatIQD(Number(p.price), lang)} · مخزون {p.stock_qty}
                  </p>
                </div>
                <Input
                  type="number"
                  defaultValue={p.stock_qty}
                  className="w-20"
                  aria-label="stock"
                  onBlur={async (e) => {
                    const v = Number(e.target.value);
                    if (v === p.stock_qty) return;
                    const { error } = await supabase
                      .from("products")
                      .update({ stock_qty: v })
                      .eq("id", p.id);
                    if (error) toast.error(error.message);
                    else invalidate(["products"]);
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  aria-label="delete"
                  onClick={async () => {
                    const { error } = await supabase.from("products").delete().eq("id", p.id);
                    if (error) toast.error(error.message);
                    else invalidate(["products"]);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* CATEGORIES */}
        <TabsContent value="categories" className="space-y-4">
          <div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>الاسم بالعربية</Label>
              <Input value={cform.name_ar} onChange={(e) => setCform({ ...cform, name_ar: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الاسم بالإنكليزية</Label>
              <Input value={cform.name_en} onChange={(e) => setCform({ ...cform, name_en: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>القسم الأب (اختياري)</Label>
              <Select value={cform.parent_id} onValueChange={(v) => setCform({ ...cform, parent_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="بدون" />
                </SelectTrigger>
                <SelectContent>
                  {(categories.data ?? [])
                    .filter((c) => !c.parent_id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name_ar}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <FileField
              label="صورة القسم"
              accept="image/*"
              folder="categories"
              value={cform.image_url}
              onChange={(url) => setCform({ ...cform, image_url: url })}
            />
            <Button
              className="sm:col-span-2"
              disabled={!cform.name_ar}
              onClick={async () => {
                const { error } = await supabase.from("categories").insert({
                  name_ar: cform.name_ar,
                  name_en: cform.name_en,
                  image_url: cform.image_url || null,
                  parent_id: cform.parent_id || null,
                });
                if (error) toast.error(error.message);
                else {
                  setCform({ name_ar: "", name_en: "", image_url: "", parent_id: "" });
                  invalidate(["categories"]);
                  toast.success("تمت الإضافة");
                }
              }}
            >
              <Plus className="size-4" /> إضافة قسم
            </Button>
          </div>
          <div className="space-y-2">
            {(categories.data ?? []).map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                <span className="flex-1 text-sm font-medium">
                  {c.parent_id ? "— " : ""}
                  {c.name_ar}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  aria-label="delete"
                  onClick={async () => {
                    const { error } = await supabase.from("categories").delete().eq("id", c.id);
                    if (error) toast.error(error.message);
                    else invalidate(["categories"]);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* SHIPPING */}
        <TabsContent value="shipping" className="space-y-2">
          {(governorates.data ?? []).map((g) => (
            <div key={g.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <span className="flex-1 text-sm font-medium">{g.name_ar}</span>
              <Input
                type="number"
                defaultValue={Number(g.shipping_cost)}
                className="w-32"
                aria-label="shipping"
                onBlur={async (e) => {
                  const v = Number(e.target.value);
                  if (v === Number(g.shipping_cost)) return;
                  const { error } = await supabase
                    .from("governorates")
                    .update({ shipping_cost: v })
                    .eq("id", g.id);
                  if (error) toast.error(error.message);
                  else {
                    invalidate(["governorates"]);
                    toast.success("تم التحديث");
                  }
                }}
              />
            </div>
          ))}
        </TabsContent>

        {/* BANNERS */}
        <TabsContent value="banners" className="space-y-4">
          <div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
            <FileField
              label="صورة البانر"
              accept="image/*"
              folder="banners"
              value={bform.image_url}
              onChange={(url) => setBform({ ...bform, image_url: url })}
            />
            <div className="space-y-2">
              <Label>العنوان بالعربية</Label>
              <Input value={bform.title_ar} onChange={(e) => setBform({ ...bform, title_ar: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الرابط</Label>
              <Input dir="ltr" value={bform.link_url} onChange={(e) => setBform({ ...bform, link_url: e.target.value })} />
            </div>
            <Button
              className="sm:col-span-2"
              disabled={!bform.image_url}
              onClick={async () => {
                const { error } = await supabase.from("banners").insert({
                  image_url: bform.image_url,
                  title_ar: bform.title_ar,
                  title_en: bform.title_en,
                  link_url: bform.link_url || null,
                });
                if (error) toast.error(error.message);
                else {
                  setBform({ image_url: "", title_ar: "", title_en: "", link_url: "" });
                  invalidate(["banners"]);
                  toast.success("تمت الإضافة");
                }
              }}
            >
              <Plus className="size-4" /> إضافة بانر
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(banners.data ?? []).map((b) => (
              <div key={b.id} className="relative overflow-hidden rounded-2xl border">
                <img src={b.image_url} alt="" className="aspect-[16/7] w-full object-cover" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 end-2"
                  aria-label="delete"
                  onClick={async () => {
                    const { error } = await supabase.from("banners").delete().eq("id", b.id);
                    if (error) toast.error(error.message);
                    else invalidate(["banners"]);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* COUPONS */}
        <TabsContent value="coupons" className="space-y-4">
          <div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>الكود</Label>
              <Input
                dir="ltr"
                value={couponForm.code}
                onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-2">
              <Label>النوع</Label>
              <Select
                value={couponForm.discount_type}
                onValueChange={(v) => setCouponForm({ ...couponForm, discount_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">مبلغ ثابت</SelectItem>
                  <SelectItem value="percent">نسبة %</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>القيمة</Label>
              <Input
                type="number"
                value={couponForm.discount_value}
                onChange={(e) => setCouponForm({ ...couponForm, discount_value: Number(e.target.value) })}
              />
            </div>
            <Button
              className="sm:col-span-3"
              disabled={!couponForm.code}
              onClick={async () => {
                const { error } = await supabase.from("coupons").insert(couponForm);
                if (error) toast.error(error.message);
                else {
                  setCouponForm({ code: "", discount_type: "fixed", discount_value: 0 });
                  toast.success("تمت الإضافة");
                }
              }}
            >
              <Plus className="size-4" /> إضافة كوبون
            </Button>
          </div>
        </TabsContent>

        {/* SETTINGS */}
        <TabsContent value="settings" className="space-y-3">
          <div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
            {[
              { key: "store_name_ar", label: "اسم المتجر (عربي)" },
              { key: "store_name_en", label: "اسم المتجر (إنكليزي)" },
              { key: "support_whatsapp", label: "رقم واتساب الدعم" },
              { key: "telegram_chat_id", label: "معرّف محادثة تيليجرام للإشعارات" },
            ].map((f) => (
              <div key={f.key} className="space-y-2">
                <Label>{f.label}</Label>
                <Input
                  defaultValue={settings.data?.[f.key] ?? ""}
                  onChange={(e) => setStore({ ...store, [f.key]: e.target.value })}
                />
              </div>
            ))}
            <FileField
              label="شعار المتجر"
              accept="image/*"
              folder="branding"
              value={store["logo_url"] ?? settings.data?.["logo_url"] ?? ""}
              onChange={(url) => setStore({ ...store, logo_url: url })}
            />
            <Button
              className="sm:col-span-2"
              onClick={async () => {
                const rows = Object.entries(store).map(([key, value]) => ({ key, value }));
                if (rows.length === 0) return;
                const { error } = await supabase.from("store_settings").upsert(rows);
                if (error) toast.error(error.message);
                else {
                  invalidate(["store_settings"]);
                  toast.success("تم الحفظ");
                }
              }}
            >
              حفظ الإعدادات
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
