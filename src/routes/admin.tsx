import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronDown,
  ClipboardList,
  Image as ImageIcon,
  LayoutGrid,
  Package,
  Plus,
  Search,
  Settings,
  Star,
  Ticket,
  Trash2,
  Truck,
  Upload,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { NumberField } from "@/components/NumberField";
import { ProductsExcel } from "@/components/ProductsExcel";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
import { ORDER_STATUSES, formatIQD, statusLabel, toLatinDigits, whatsappLink } from "@/lib/format";
import { localized, useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  allReviewsQuery,
  allSolarComponentsQuery,
  bannersQuery,
  categoriesQuery,
  governoratesQuery,
  productsQuery,
  settingsQuery,
  stockAlertsQuery,
} from "@/lib/queries";


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

/** Collapsible admin card whose open/closed state survives reloads. */
function Panel({
  id,
  title,
  desc,
  action,
  children,
  defaultOpen = true,
}: {
  id: string;
  title: string;
  desc?: string;
  action?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const stored = localStorage.getItem(`admin_panel_${id}`);
    if (stored === "0" || stored === "1") setOpen(stored === "1");
  }, [id]);

  return (
    <Collapsible
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        localStorage.setItem(`admin_panel_${id}`, v ? "1" : "0");
      }}
      className="rounded-2xl border bg-card"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
        <CollapsibleTrigger className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-start">
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{title}</span>
            {desc && <span className="block truncate text-xs text-muted-foreground">{desc}</span>}
          </span>
          <ChevronDown
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </CollapsibleTrigger>
        {action}
      </div>
      <CollapsibleContent>
        <div className="border-t p-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
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
  images_text: "",
  deal_ends_at: "",

const emptySolar = {
  kind: "panel",
  name_ar: "",
  name_en: "",
  capacity: 0,
  voltage: 51.2,
  price: 0,
};


function AdminPage() {
  const { lang } = useLang();
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();

  const products = useQuery(productsQuery);
  const categories = useQuery(categoriesQuery);
  const reviews = useQuery(allReviewsQuery);
  const alerts = useQuery(stockAlertsQuery);
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
  const [tab, setTab] = useState("orders");
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"all" | "products" | "orders">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    const stored = localStorage.getItem("admin_tab");
    if (stored) setTab(stored);
  }, []);

  const saveProduct = useMutation({
    mutationFn: async () => {
      const { images_text, deal_ends_at, ...rest } = pform;
      const { error } = await supabase.from("products").insert({
        ...rest,
        category_id: pform.category_id || null,
        discount_price: pform.discount_price || null,
        images: images_text
          .split(/[\n,]/)
          .map((u) => u.trim())
          .filter(Boolean),
        deal_ends_at: deal_ends_at ? new Date(deal_ends_at).toISOString() : null,
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

  const needle = q.trim().toLowerCase();
  const allProducts = products.data ?? [];

  const matchOrder = (o: Record<string, any>) =>
    !needle ||
    [o["order_number"], o["customer_name"], o["phone"], o["governorate_name"]]
      .join(" ")
      .toLowerCase()
      .includes(needle);

  const visibleOrders =
    scope === "products"
      ? []
      : allOrders.filter(
          (o) => matchOrder(o) && (statusFilter === "all" || o["status"] === statusFilter),
        );

  const visibleProducts =
    scope === "orders"
      ? []
      : allProducts.filter(
          (p) => !needle || [p.name_ar, p.name_en, p.sku].join(" ").toLowerCase().includes(needle),
        );

  const searchActive = !!needle || scope !== "all" || statusFilter !== "all";

  // --- quick stats -------------------------------------------------------
  const now = Date.now();
  const newOrders24h = allOrders.filter(
    (o) => now - new Date(o["created_at"]).getTime() < 24 * 3600 * 1000,
  ).length;
  const statusCounts = [...ORDER_STATUSES, "cancelled"].map((s) => ({
    key: s,
    label: statusLabel(s, lang),
    count: allOrders.filter((o) => o["status"] === s).length,
  }));
  const maxStatus = Math.max(1, ...statusCounts.map((s) => s.count));

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * 24 * 3600 * 1000);
    const key = d.toISOString().slice(0, 10);
    const total = allOrders
      .filter((o) => o["status"] !== "cancelled" && String(o["created_at"]).slice(0, 10) === key)
      .reduce((s, o) => s + Number(o["total_amount"]), 0);
    return { key, label: d.toLocaleDateString("ar-IQ-u-nu-latn", { weekday: "short" }), total };
  });
  const maxDay = Math.max(1, ...days.map((d) => d.total));

  const outOfStock = allProducts.filter((p) => p.stock_qty <= 0).length;
  const lowStockCount = allProducts.filter((p) => p.stock_qty > 0 && p.stock_qty <= 2).length;
  const inStock = allProducts.length - outOfStock - lowStockCount;
  const stockBars = [
    { label: "متوفر", count: inStock, cls: "bg-primary" },
    { label: "منخفض", count: lowStockCount, cls: "bg-amber-500" },
    { label: "نافد", count: outOfStock, cls: "bg-destructive" },
  ];
  const stockTotal = Math.max(1, allProducts.length);



  const sections = [
    { value: "orders", label: "الطلبات", desc: "متابعة الطلبات وتحديث حالتها", icon: ClipboardList },
    { value: "products", label: "المنتجات", desc: "إضافة المنتجات واستيرادها من Excel", icon: Package },
    { value: "categories", label: "الأقسام", desc: "تنظيم أقسام المتجر", icon: LayoutGrid },
    { value: "shipping", label: "المحافظات", desc: "أجور التوصيل لكل محافظة", icon: Truck },
    { value: "banners", label: "البانرات", desc: "صور الواجهة الرئيسية", icon: ImageIcon },
    { value: "coupons", label: "الكوبونات", desc: "أكواد الخصم", icon: Ticket },
    { value: "reviews", label: "التقييمات", desc: "اعتماد تقييمات الزبائن وطلبات الإشعار", icon: Star },
    { value: "settings", label: "الإعدادات", desc: "معلومات المتجر والتواصل", icon: Settings },
  ];
  const active = sections.find((s) => s.value === tab) ?? sections[0]!;

  const changeTab = (v: string) => {
    setTab(v);
    localStorage.setItem("admin_tab", v);
  };

  return (
    <div className="space-y-6">
      <header className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-xl font-bold">لوحة الإدارة</h1>
          <p className="text-xs text-muted-foreground">إدارة المتجر مقسّمة إلى أقسام مستقلة</p>
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[18rem_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث سريع عن منتج أو طلب..."
              aria-label="بحث سريع"
              className="h-10 rounded-full bg-sand ps-9"
            />
          </div>
          <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <SelectTrigger className="h-10 rounded-full" aria-label="نطاق البحث">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="products">المنتجات</SelectItem>
              <SelectItem value="orders">الطلبات</SelectItem>
            </SelectContent>
          </Select>
          {scope !== "products" && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 rounded-full" aria-label="حالة الطلب">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {[...ORDER_STATUSES, "cancelled"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabel(s, lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </header>

      {searchActive && (
        <p className="text-xs text-muted-foreground">
          نتائج البحث: {visibleProducts.length} منتج · {visibleOrders.length} طلب
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">نظرة عامة</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "طلبات جديدة (24 ساعة)", value: newOrders24h },
            { label: "قيد المراجعة", value: pending },
            { label: "المنتجات", value: allProducts.length },
            { label: "إجمالي المبيعات", value: formatIQD(revenue, lang) },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-lg font-bold text-primary">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-sm font-bold">مبيعات آخر 7 أيام</p>
            <div className="mt-4 flex h-28 items-end gap-2">
              {days.map((d) => (
                <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-primary/80"
                    style={{ height: `${Math.max(4, (d.total / maxDay) * 90)}%` }}
                    title={formatIQD(d.total, lang)}
                  />
                  <span className="truncate text-[10px] text-muted-foreground">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <p className="text-sm font-bold">الطلبات حسب الحالة</p>
            <div className="mt-3 space-y-2">
              {statusCounts.map((s) => (
                <div key={s.key} className="grid grid-cols-[5rem_minmax(0,1fr)_2rem] items-center gap-2">
                  <span className="truncate text-xs text-muted-foreground">{s.label}</span>
                  <span className="h-2 rounded-full bg-muted">
                    <span
                      className="block h-2 rounded-full bg-primary"
                      style={{ width: `${(s.count / maxStatus) * 100}%` }}
                    />
                  </span>
                  <span className="text-end text-xs font-semibold">{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <p className="text-sm font-bold">حالة المخزون</p>
            <div className="mt-3 space-y-2">
              {stockBars.map((s) => (
                <div key={s.label} className="grid grid-cols-[4rem_minmax(0,1fr)_2rem] items-center gap-2">
                  <span className="truncate text-xs text-muted-foreground">{s.label}</span>
                  <span className="h-2 rounded-full bg-muted">
                    <span
                      className={cn("block h-2 rounded-full", s.cls)}
                      style={{ width: `${(s.count / stockTotal) * 100}%` }}
                    />
                  </span>
                  <span className="text-end text-xs font-semibold">{s.count}</span>
                </div>
              ))}
            </div>
            {lowStock.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                تنبيه: {lowStock.length} منتج بحاجة إعادة تخزين
              </p>
            )}
          </div>
        </div>
      </section>


      <Tabs
        value={tab}
        onValueChange={changeTab}
        className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]"
      >
        <aside className="space-y-3 lg:sticky lg:top-20">
          <h2 className="text-sm font-semibold text-muted-foreground">أقسام الإدارة</h2>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0 sm:grid-cols-4 lg:grid-cols-1">
            {sections.map((s) => (
              <TabsTrigger
                key={s.value}
                value={s.value}
                className="flex h-auto w-full flex-col items-center gap-1.5 rounded-2xl border bg-card px-3 py-3 text-xs font-semibold data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground lg:flex-row lg:justify-start lg:gap-2.5 lg:text-sm"
              >
                <s.icon className="size-4 shrink-0" />
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </aside>

        <div className="min-w-0 space-y-4">
        <div className="space-y-1 border-b pb-4 lg:border-b-0 lg:pb-0">
          <h2 className="text-base font-bold">{active.label}</h2>
          <p className="text-xs text-muted-foreground">{active.desc}</p>
        </div>



        {/* ORDERS */}
        <TabsContent value="orders" className="space-y-4">
          {visibleOrders.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">لا توجد طلبات</p>
          )}
          {visibleOrders.map((o) => (
            <div key={o["id"]} className="space-y-3 rounded-2xl border bg-card p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <h3 className="truncate text-sm font-bold">
                  #{o["order_number"]} — {o["customer_name"]}
                </h3>

                <span className="text-xs text-muted-foreground">
                  {new Date(o["created_at"]).toLocaleString("ar-IQ-u-nu-latn")}
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
          <ProductsExcel
            categories={categories.data ?? []}
            products={(products.data ?? []) as never}
            onDone={() => invalidate(["products"])}
          />
          <Panel id="product-new" title="إضافة منتج" desc="أدخل بيانات المنتج الجديد">
          <div className="grid gap-4 sm:grid-cols-2">

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
              <NumberField
                value={pform.price}
                onValueChange={(v) => setPform({ ...pform, price: v ?? 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>سعر الخصم</Label>
              <NumberField
                allowEmpty
                value={pform.discount_price}
                onValueChange={(v) => setPform({ ...pform, discount_price: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>الكمية</Label>
              <NumberField
                value={pform.stock_qty}
                onValueChange={(v) => setPform({ ...pform, stock_qty: v ?? 0 })}
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
            <div className="space-y-2 sm:col-span-2">
              <Label>صور إضافية (رابط في كل سطر)</Label>
              <Textarea
                rows={2}
                dir="ltr"
                value={pform.images_text}
                onChange={(e) => setPform({ ...pform, images_text: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>نهاية العرض (اختياري)</Label>
              <Input
                type="datetime-local"
                value={pform.deal_ends_at}
                onChange={(e) => setPform({ ...pform, deal_ends_at: e.target.value })}
              />
            </div>
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
          </Panel>

          {lowStock.length > 0 && (
            <div className="rounded-2xl border border-warning bg-warning/10 p-4 text-sm">
              <p className="font-semibold">تنبيه انخفاض المخزون:</p>
              {lowStock.map((p) => (
                <span key={p.id} className="me-2">
                  {p.name_ar} ({p.stock_qty})
                </span>
              ))}
            </div>
          )}

          <Panel id="product-list" title={`قائمة المنتجات (${visibleProducts.length})`} desc="تعديل المخزون أو الحذف">
          <div className="space-y-3">
            {visibleProducts.map((p) => (

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
                  type="text" inputMode="numeric" dir="ltr"
                  defaultValue={p.stock_qty}
                  className="w-20"
                  aria-label="stock"
                  onBlur={async (e) => {
                    const v = Number(toLatinDigits(e.target.value));
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
          </Panel>
        </TabsContent>

        {/* CATEGORIES */}
        <TabsContent value="categories" className="space-y-4">
          <Panel id="cat-new" title="إضافة قسم" desc="أنشئ قسماً رئيسياً أو فرعياً">
          <div className="grid gap-4 sm:grid-cols-2">

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
          </Panel>
          <Panel id="cat-list" title="قائمة الأقسام" desc="حذف الأقسام غير المستخدمة">
          <div className="space-y-3">
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
          </Panel>
        </TabsContent>

        {/* SHIPPING */}
        <TabsContent value="shipping" className="space-y-4">
          <Panel id="gov-list" title="أجور التوصيل" desc="حدد أجرة التوصيل لكل محافظة">
          <div className="space-y-3">
          {(governorates.data ?? []).map((g) => (
            <div key={g.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <span className="flex-1 text-sm font-medium">{g.name_ar}</span>
              <Input
                type="text" inputMode="numeric" dir="ltr"
                defaultValue={Number(g.shipping_cost)}
                className="w-32"
                aria-label="shipping"
                onBlur={async (e) => {
                  const v = Number(toLatinDigits(e.target.value));
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
          </div>
          </Panel>
        </TabsContent>

        {/* BANNERS */}
        <TabsContent value="banners" className="space-y-4">
          <Panel id="banner-new" title="إضافة بانر" desc="صور تظهر في أعلى الصفحة الرئيسية">
          <div className="grid gap-4 sm:grid-cols-2">

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
          </Panel>
          <Panel id="banner-list" title="البانرات الحالية" desc="حذف البانرات القديمة">
          <div className="grid gap-4 sm:grid-cols-2">
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
          </Panel>
        </TabsContent>

        {/* COUPONS */}
        <TabsContent value="coupons" className="space-y-4">
          <Panel id="coupon-new" title="إضافة كوبون" desc="أكواد خصم ثابتة أو بنسبة مئوية">
          <div className="grid gap-4 sm:grid-cols-3">

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
              <NumberField
                value={couponForm.discount_value}
                onValueChange={(v) => setCouponForm({ ...couponForm, discount_value: v ?? 0 })}
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
          </Panel>
        </TabsContent>

        {/* SOLAR */}
        <TabsContent value="solar" className="space-y-4">
          <Panel id="solar-new" title="إضافة مكوّن" desc="ألواح، بطاريات ليثيوم، إنفرترات مع أسعارها">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>النوع</Label>
                <Select
                  value={solarForm.kind}
                  onValueChange={(v) => setSolarForm({ ...solarForm, kind: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="panel">لوح شمسي</SelectItem>
                    <SelectItem value="battery">بطارية LiFePO4</SelectItem>
                    <SelectItem value="inverter">إنفرتر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الاسم بالعربية</Label>
                <Input
                  value={solarForm.name_ar}
                  onChange={(e) => setSolarForm({ ...solarForm, name_ar: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>الاسم بالإنجليزية</Label>
                <Input
                  dir="ltr"
                  value={solarForm.name_en}
                  onChange={(e) => setSolarForm({ ...solarForm, name_en: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {solarForm.kind === "panel"
                    ? "واطية اللوح (W)"
                    : solarForm.kind === "battery"
                      ? "سعة البطارية (Ah)"
                      : "قدرة الإنفرتر (kW)"}
                </Label>
                <NumberField
                  value={solarForm.capacity}
                  onValueChange={(v) => setSolarForm({ ...solarForm, capacity: v ?? 0 })}
                />
              </div>
              {solarForm.kind === "battery" && (
                <div className="space-y-2">
                  <Label>فولتية البطارية (V)</Label>
                  <NumberField
                    value={solarForm.voltage}
                    onValueChange={(v) => setSolarForm({ ...solarForm, voltage: v ?? 0 })}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>السعر (د.ع)</Label>
                <NumberField
                  value={solarForm.price}
                  onValueChange={(v) => setSolarForm({ ...solarForm, price: v ?? 0 })}
                />
              </div>
              <Button
                className="sm:col-span-2"
                disabled={!solarForm.name_ar}
                onClick={async () => {
                  const { error } = await supabase.from("solar_components").insert(solarForm as never);
                  if (error) toast.error(error.message);
                  else {
                    setSolarForm({ ...emptySolar });
                    invalidate(["solar_components"]);
                    toast.success("تمت الإضافة");
                  }
                }}
              >
                <Plus className="size-4" /> إضافة مكوّن
              </Button>
            </div>
          </Panel>

          <Panel id="solar-list" title="مكوّنات المنظومة" desc="تعديل الأسعار أو الحذف">
            <div className="space-y-2">
              {(solarComponents.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد مكوّنات</p>
              )}
              {(solarComponents.data ?? []).map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[minmax(0,1fr)_6rem_auto] items-center gap-2 rounded-xl border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.name_ar}</p>
                    <p className="text-[11px] text-muted-foreground" dir="ltr">
                      {c.kind === "panel"
                        ? `${c.capacity}W`
                        : c.kind === "battery"
                          ? `${c.capacity}Ah / ${c.voltage}V`
                          : `${c.capacity}kW`}
                    </p>
                  </div>
                  <NumberField
                    value={Number(c.price)}
                    aria-label="السعر"
                    onValueChange={async (v) => {
                      await supabase
                        .from("solar_components")
                        .update({ price: v ?? 0 })
                        .eq("id", c.id);
                      invalidate(["solar_components"]);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="حذف"
                    onClick={async () => {
                      await supabase.from("solar_components").delete().eq("id", c.id);
                      invalidate(["solar_components"]);
                    }}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </Panel>
        </TabsContent>

        {/* SETTINGS */}
        <TabsContent value="reviews" className="space-y-4">
          <Panel id="reviews-pending" title="التقييمات" desc="اعتمد التقييمات لتظهر في صفحة المنتج">
            <div className="space-y-2">
              {(reviews.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد تقييمات</p>
              )}
              {(reviews.data ?? []).map((r) => {
                const prod = (products.data ?? []).find((p) => p.id === r.product_id);
                return (
                  <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {prod ? localized(lang, prod.name_ar, prod.name_en) : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.author_name || "—"} • {r.rating}/5
                      </p>
                      {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
                    </div>
                    {!r.is_approved ? (
                      <Button
                        size="sm"
                        onClick={async () => {
                          const { error } = await supabase
                            .from("reviews")
                            .update({ is_approved: true })
                            .eq("id", r.id);
                          if (error) toast.error(error.message);
                          else {
                            toast.success("تم الاعتماد");
                            invalidate(["reviews"]);
                          }
                        }}
                      >
                        اعتماد
                      </Button>
                    ) : (
                      <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-accent-foreground">
                        معتمد
                      </span>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="حذف"
                      onClick={async () => {
                        const { error } = await supabase.from("reviews").delete().eq("id", r.id);
                        if (error) toast.error(error.message);
                        else invalidate(["reviews"]);
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel id="stock-alerts" title="طلبات الإشعار بالتوفر" desc="أرقام الزبائن المنتظرين توفر المنتجات">
            <div className="space-y-2">
              {(alerts.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد طلبات</p>
              )}
              {(alerts.data ?? []).map((a) => {
                const prod = (products.data ?? []).find((p) => p.id === a["product_id"]);
                return (
                  <div key={a["id"] as string} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {prod ? localized(lang, prod.name_ar, prod.name_en) : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {a["phone"] as string}
                      </p>
                    </div>
                    <a
                      href={whatsappLink(String(a["phone"]), "المنتج متوفر الآن في SmartTech")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border px-3 py-1 text-xs font-semibold"
                    >
                      واتساب
                    </a>
                  </div>
                );
              })}
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Panel id="set-store" title="معلومات المتجر" desc="الاسم والشعار والنبذة التعريفية">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { key: "store_name_ar", label: "اسم المتجر (عربي)" },
                { key: "store_name_en", label: "اسم المتجر (إنكليزي)" },
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
              <div className="space-y-2">
                <Label>ساعات العمل</Label>
                <Input
                  defaultValue={settings.data?.["working_hours"] ?? ""}
                  placeholder="السبت - الخميس، 9 صباحاً - 9 مساءً"
                  onChange={(e) => setStore({ ...store, working_hours: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>نبذة عن المتجر (عربي)</Label>
                <Textarea
                  rows={3}
                  defaultValue={settings.data?.["store_about_ar"] ?? ""}
                  onChange={(e) => setStore({ ...store, store_about_ar: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>نبذة عن المتجر (إنكليزي)</Label>
                <Textarea
                  rows={3}
                  defaultValue={settings.data?.["store_about_en"] ?? ""}
                  onChange={(e) => setStore({ ...store, store_about_en: e.target.value })}
                />
              </div>
            </div>
          </Panel>

          <Panel id="set-contact" title="تفاصيل التواصل" desc="أرقام الهاتف والعنوان وروابط التواصل">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { key: "support_whatsapp", label: "رقم واتساب الدعم", ltr: true },
                { key: "store_phone", label: "رقم الهاتف", ltr: true },
                { key: "store_email", label: "البريد الإلكتروني", ltr: true },
                { key: "store_address", label: "عنوان المتجر" },
                { key: "facebook_url", label: "رابط فيسبوك", ltr: true },
                { key: "instagram_url", label: "رابط إنستغرام", ltr: true },
                { key: "telegram_chat_id", label: "معرّف محادثة تيليجرام للإشعارات", ltr: true },
              ].map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label>{f.label}</Label>
                  <Input
                    dir={f.ltr ? "ltr" : undefined}
                    defaultValue={settings.data?.[f.key] ?? ""}
                    onChange={(e) => setStore({ ...store, [f.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </Panel>

          <Button
            className="w-full"
            disabled={Object.keys(store).length === 0}
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
        </TabsContent>
        </div>
      </Tabs>
    </div>

  );
}
