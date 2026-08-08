import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronDown,
  ClipboardList,
  Image as ImageIcon,
  LayoutGrid,
  Package,
  Pencil,
  Plus,

  Search,
  Settings,
  Star,
  Sun,
  Ticket,
  Trash2,
  Truck,
  Upload,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { NumberField } from "@/components/NumberField";
import { PricingTiersEditor } from "@/components/PricingTiersEditor";
import { announceDeal, createCoupon, notifyRestock, updateOrderStatus } from "@/lib/admin.functions";
import { BulkDeleteProducts } from "@/components/BulkDeleteProducts";
import { OrderAdminTools } from "@/components/OrderAdminTools";
import { ProfitsExcel } from "@/components/ProfitsExcel";
import { CategoriesExcel } from "@/components/CategoriesExcel";
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
import { Pagination } from "@/components/Pagination";
import { CropSettingsPanel } from "@/components/CropSettingsPanel";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_ICON_KEYS, CategoryIcon } from "@/lib/category-icons";
import { useAuth } from "@/lib/auth";
import { ORDER_STATUSES, discountPriceFromPercent, formatIQD, statusGroupLabel, statusLabel, toLatinDigits, whatsappLink } from "@/lib/format";
import { localized, useLang } from "@/lib/i18n";
import { setItemUnavailable } from "@/lib/orders.functions";
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
  type Product,
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

/** Decodes a file to a bitmap-ish source, with a Safari-friendly fallback. */
async function decodeImage(file: File): Promise<{ width: number; height: number; src: CanvasImageSource } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, src: bitmap };
  } catch {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.decoding = "async";
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("decode"));
        img.src = url;
      });
      URL.revokeObjectURL(url);
      return { width: img.naturalWidth, height: img.naturalHeight, src: img };
    } catch {
      return null;
    }
  }
}

/** Shrinks big images in the browser so uploads don't fail on slow/large payloads. */
async function compressImage(file: File, max = 1600, target = 700 * 1024): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
  if (file.size <= 120 * 1024) return file;
  const decoded = await decodeImage(file);
  if (!decoded) return file;
  let width = decoded.width;
  let height = decoded.height;
  const scale = Math.min(1, max / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  for (let step = 0; step < 5; step++) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(decoded.src, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/webp", 0.85 - step * 0.12),
    );
    if (!blob) return file;
    if (blob.size <= target || step === 4) {
      if (blob.size >= file.size) return file;
      return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
    }
    width = Math.max(1, Math.round(width * 0.8));
    height = Math.max(1, Math.round(height * 0.8));
  }
  return file;
}

/** Uploads to the private store-media bucket and returns a long-lived signed URL. */
async function uploadMedia(input: File, folder: string) {
  const file = await compressImage(input);
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("حجم الملف كبير جداً (الحد 8 ميغابايت) — يرجى اختيار ملف أصغر");
  }
  const path = `${folder}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Refresh the session first: an expired token makes the upload fail as a network error.
      if (attempt > 0) await supabase.auth.refreshSession();
      const { error } = await supabase.storage
        .from("store-media")
        .upload(path, file, { upsert: true, contentType: file.type || "application/octet-stream" });
      if (error) throw error;
      const { data, error: signErr } = await supabase.storage
        .from("store-media")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signErr) throw signErr;
      return data.signedUrl;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : "";
  if (/failed to fetch|network/i.test(msg)) {
    throw new Error("تعذّر الاتصال أثناء الرفع — تحقق من الإنترنت أو جرّب صورة أصغر");
  }
  throw lastErr instanceof Error ? lastErr : new Error("فشل رفع الملف");
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
  openSignal = 0,
}: {
  id: string;
  title: string;
  desc?: string;
  action?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Increment to force the panel open (e.g. when editing starts). */
  openSignal?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const stored = localStorage.getItem(`admin_panel_${id}`);
    if (stored === "0" || stored === "1") setOpen(stored === "1");
  }, [id]);

  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);

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


function IconPicker({
  value,
  onChange,
  label = "الأيقونة",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
        <SelectTrigger>
          <SelectValue placeholder="بدون أيقونة" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value="none">بدون أيقونة</SelectItem>
          {CATEGORY_ICON_KEYS.map((k) => (
            <SelectItem key={k} value={k}>
              <span className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center">
                  <CategoryIcon icon={k} />
                </span>
                {k}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const ADMIN_PER_PAGE = 100;

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
};

const emptySolar = {
  kind: "panel",
  name_ar: "",
  name_en: "",
  brand: "",
  tier: "mid",
  capacity: 0,
  voltage: 51.2,
  price: 0,
};

const TIER_LABEL: Record<string, string> = {
  economy: "اقتصادي",
  mid: "متوسط",
  pro: "احترافي",
};



function AdminPage() {
  const { lang } = useLang();
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();

  const products = useQuery(productsQuery);
  const categories = useQuery(categoriesQuery);
  const reviews = useQuery(allReviewsQuery);
  const alerts = useQuery(stockAlertsQuery);
  const solarComponents = useQuery(allSolarComponentsQuery);
  const governorates = useQuery(governoratesQuery);
  const banners = useQuery(bannersQuery);
  const settings = useQuery(settingsQuery);
  const orders = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(id, product_name, quantity, unit_price, is_unavailable)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = (keys: string[]) =>
    keys.forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const [pform, setPform] = useState({ ...emptyProduct });
  const [cform, setCform] = useState({
    name_ar: "",
    name_en: "",
    image_url: "",
    icon: "",
    parent_id: "",
  });
  const [bform, setBform] = useState({
    image_url: "",
    title_ar: "",
    title_en: "",
    description_ar: "",
    description_en: "",
    link_url: "",
  });
  const [prodPage, setProdPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSignal, setEditSignal] = useState(0);
  const [prevDiscount, setPrevDiscount] = useState<number | null>(null);
  const [couponForm, setCouponForm] = useState({
    code: "",
    discount_type: "fixed",
    discount_value: 0,
    expires_at: "",
  });
  const [solarForm, setSolarForm] = useState({ ...emptySolar });
  const [store, setStore] = useState<Record<string, string>>({});
  const markUnavailable = useServerFn(setItemUnavailable);
  const changeStatus = useServerFn(updateOrderStatus);
  const addCoupon = useServerFn(createCoupon);
  const sendDealNotice = useServerFn(announceDeal);
  const sendRestockNotice = useServerFn(notifyRestock);
  const [tab, setTab] = useState("orders");
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"all" | "products" | "orders">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    const stored = localStorage.getItem("admin_tab");
    if (stored) setTab(stored);
  }, []);

  useEffect(() => {
    setProdPage(1);
  }, [q, scope]);

  const saveProduct = useMutation({
    mutationFn: async () => {
      const { images_text, deal_ends_at, ...rest } = pform;
      const values = {
        ...rest,
        category_id: pform.category_id || null,
        discount_price: pform.discount_price || null,
        images: images_text
          .split(/[\n,]/)
          .map((u) => u.trim())
          .filter(Boolean),
        deal_ends_at: deal_ends_at ? new Date(deal_ends_at).toISOString() : null,
      };
      const { data, error } = editingId
        ? await supabase.from("products").update(values).eq("id", editingId).select("id").single()
        : await supabase.from("products").insert(values).select("id").single();
      if (error) throw error;

      // A newly added (or changed) discount is announced to all customers.
      const dp = Number(values.discount_price ?? 0);
      const price = Number(values.price) || 0;
      const percent = dp > 0 && dp < price ? Math.round(((price - dp) / price) * 100) : 0;
      if (percent > 0 && dp !== prevDiscount && data?.id) {
        try {
          await sendDealNotice({
            data: {
              product_id: String(data.id),
              name: values.name_ar || values.name_en || "منتج",
              percent,
            },
          });
        } catch {
          /* the product is saved even if the announcement fails */
        }
      }

      // Customers waiting for this product are told it is available again.
      if (Number(values.stock_qty) > 0 && data?.id) {
        try {
          await sendRestockNotice({
            data: {
              product_id: String(data.id),
              name: values.name_ar || values.name_en || "منتج",
            },
          });
        } catch {
          /* the product is saved even if the alert fails */
        }
      }
    },
    onSuccess: () => {
      const wasEditing = !!editingId;
      setPform({ ...emptyProduct });
      setEditingId(null);
      setPrevDiscount(null);
      invalidate(["products"]);
      toast.success(wasEditing ? "تم حفظ التعديلات" : "تمت الإضافة");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditSignal((n) => n + 1);
    setPrevDiscount(
      (p.base_discount_price ?? p.discount_price) === null
        ? null
        : Number(p.base_discount_price ?? p.discount_price),
    );
    setTab("products");
    setPform({
      sku: p.sku ?? "",
      name_ar: p.name_ar ?? "",
      name_en: p.name_en ?? "",
      description_ar: p.description_ar ?? "",
      description_en: p.description_en ?? "",
      price: Number(p.base_price ?? p.price) || 0,
      discount_price:
        (p.base_discount_price ?? p.discount_price) === null
          ? null
          : Number(p.base_discount_price ?? p.discount_price),

      category_id: p.category_id ?? null,
      image_url: p.image_url ?? "",
      catalog_pdf_url: p.catalog_pdf_url ?? "",
      stock_qty: Number(p.stock_qty) || 0,
      is_featured: !!p.is_featured,
      images_text: (p.images ?? []).join("\n"),
      deal_ends_at: p.deal_ends_at ? new Date(p.deal_ends_at).toISOString().slice(0, 16) : "",
    });
    setTimeout(
      () =>
        document
          .getElementById("product-new")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  };


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
    { value: "solar", label: "الطاقة الشمسية", desc: "الألواح والبطاريات والإنفرترات وأسعارها", icon: Sun },
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
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "كل الطلبات" },
              ...[...ORDER_STATUSES, "cancelled"].map((s) => ({
                key: s,
                label: statusGroupLabel(s, lang),
              })),
            ].map((tab) => {
              const count =
                tab.key === "all"
                  ? allOrders.filter(matchOrder).length
                  : allOrders.filter((o) => matchOrder(o) && o["status"] === tab.key).length;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    statusFilter === tab.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  {tab.label} ({count})
                </button>
              );
            })}
          </div>

          <ProfitsExcel
            orders={visibleOrders}
            selected={selectedOrders}
            selectionMode={selectionMode}
            onToggleMode={(v) => {
              setSelectionMode(v);
              if (!v) setSelectedOrders([]);
            }}
          />

          {visibleOrders.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">لا توجد طلبات</p>
          )}
          {visibleOrders.map((o) => (
            <div key={o["id"]} className="space-y-3 rounded-2xl border bg-card p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <h3 className="flex items-center gap-2 truncate text-sm font-bold">
                  {selectionMode && (
                    <input
                      type="checkbox"
                      className="size-4 accent-[hsl(var(--primary))]"
                      checked={selectedOrders.includes(String(o["id"]))}
                      onChange={(e) =>
                        setSelectedOrders((prev) =>
                          e.target.checked
                            ? [...prev, String(o["id"])]
                            : prev.filter((id) => id !== String(o["id"])),
                        )
                      }
                    />
                  )}
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
              <ul className="space-y-1 text-sm">
                {(o["order_items"] ?? []).map((it: Record<string, any>) => (
                  <li key={it["id"]} className="flex flex-wrap items-center gap-2">
                    <span className={it["is_unavailable"] ? "text-muted-foreground line-through" : ""}>
                      • {it["product_name"]} × {it["quantity"]} —{" "}
                      {formatIQD(Number(it["unit_price"]) * Number(it["quantity"]), lang)}
                    </span>
                    <Button
                      size="sm"
                      variant={it["is_unavailable"] ? "secondary" : "outline"}
                      className="h-7 rounded-full text-xs"
                      onClick={async () => {
                        try {
                          await markUnavailable({
                            data: {
                              order_item_id: String(it["id"]),
                              is_unavailable: !it["is_unavailable"],
                            },
                          });
                          invalidate(["admin-orders", "orders"]);
                          toast.success("تم التحديث وإشعار الزبون");
                        } catch {
                          toast.error("تعذر التحديث");
                        }
                      }}
                    >
                      {it["is_unavailable"] ? "إرجاع كمتوفر" : "غير متوفر"}
                    </Button>
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
                    try {
                      await changeStatus({
                        data: { order_id: String(o["id"]), status: status as never },
                      });
                      invalidate(["admin-orders", "orders", "notifications"]);
                      toast.success("تم التحديث وإرسال إشعار للزبون");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "خطأ");
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
              <OrderAdminTools order={o} settings={(settings.data ?? {}) as Record<string, string>} />

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
          <Panel
            id="product-new"
            openSignal={editSignal}
            title={editingId ? "تعديل منتج" : "إضافة منتج"}
            desc={editingId ? "عدّل بيانات المنتج ثم احفظ" : "أدخل بيانات المنتج الجديد"}
          >

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
              <Label>نسبة الخصم %</Label>
              <NumberField
                allowEmpty
                value={
                  pform.discount_price && pform.price
                    ? Math.round(
                        ((pform.price - pform.discount_price) / pform.price) * 100,
                      )
                    : null
                }
                onValueChange={(v) =>
                  setPform({
                    ...pform,
                    discount_price: discountPriceFromPercent(pform.price, v ?? 0),
                  })
                }
              />
              {pform.discount_price ? (
                <p className="text-xs text-destructive">
                  السعر بعد الخصم: {formatIQD(pform.discount_price, "ar")}
                </p>
              ) : null}
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
            <div className="flex gap-2 sm:col-span-2">
              <Button
                className="flex-1"
                disabled={saveProduct.isPending || !pform.name_ar}
                onClick={() => saveProduct.mutate()}
              >
                {editingId ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                {editingId ? "حفظ التعديلات" : "إضافة المنتج"}
              </Button>
              {editingId && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setPform({ ...emptyProduct });
                  }}
                >
                  إلغاء
                </Button>
              )}
            </div>

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

          <BulkDeleteProducts
            categories={(categories.data ?? []) as never}
            counts={{
              all: allProducts.length,
              none: allProducts.filter((p) => !p.category_id).length,
              ...Object.fromEntries(
                (categories.data ?? []).map((c) => [
                  c.id,
                  allProducts.filter((p) => {
                    if (p.category_id === c.id) return true;
                    const parent = (categories.data ?? []).find((x) => x.id === p.category_id);
                    return parent?.parent_id === c.id;
                  }).length,
                ]),
              ),
            }}
            onDone={() => invalidate(["products"])}
          />

          <Panel
            id="product-list"
            title={`قائمة المنتجات (${visibleProducts.length})`}
            desc="100 منتج في كل صفحة — البحث يشمل كل المنتجات"
          >
          <div className="space-y-3">
            {visibleProducts
              .slice((Math.min(prodPage, Math.max(1, Math.ceil(visibleProducts.length / ADMIN_PER_PAGE))) - 1) * ADMIN_PER_PAGE, Math.min(prodPage, Math.max(1, Math.ceil(visibleProducts.length / ADMIN_PER_PAGE))) * ADMIN_PER_PAGE)
              .map((p) => (

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
                    else {
                      invalidate(["products"]);
                      if (v > 0 && p.stock_qty <= 0) {
                        try {
                          const r = (await sendRestockNotice({
                            data: { product_id: p.id, name: p.name_ar || "منتج" },
                          })) as { sent: number };
                          if (r.sent) toast.success(`تم إشعار ${r.sent} زبون بتوفر المنتج`);
                        } catch {
                          /* stock is updated even if the alert fails */
                        }
                      }
                    }
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="edit"
                  onClick={() => startEdit(p)}
                >
                  <Pencil className="size-4" />
                </Button>
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
          <Pagination
            page={Math.min(prodPage, Math.max(1, Math.ceil(visibleProducts.length / ADMIN_PER_PAGE)))}
            totalPages={Math.max(1, Math.ceil(visibleProducts.length / ADMIN_PER_PAGE))}
            onPage={setProdPage}
          />
          </Panel>
        </TabsContent>

        {/* CATEGORIES */}
        <TabsContent value="categories" className="space-y-4">
          <CategoriesExcel
            categories={(categories.data ?? []) as never}
            onDone={() => invalidate(["categories"])}
          />

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
              label="صورة القسم (اختياري)"
              accept="image/*"
              folder="categories"
              value={cform.image_url}
              onChange={(url) => setCform({ ...cform, image_url: url })}
            />
            <IconPicker
              value={cform.icon}
              onChange={(v) => setCform({ ...cform, icon: v })}
              label="أيقونة القسم (تظهر إذا لم توجد صورة)"
            />
            <Button
              className="sm:col-span-2"
              disabled={!cform.name_ar}
              onClick={async () => {
                const { error } = await supabase.from("categories").insert({
                  name_ar: cform.name_ar,
                  name_en: cform.name_en,
                  image_url: cform.image_url || null,
                  icon: cform.icon,
                  parent_id: cform.parent_id || null,
                });
                if (error) toast.error(error.message);
                else {
                  setCform({ name_ar: "", name_en: "", image_url: "", icon: "", parent_id: "" });
                  invalidate(["categories"]);
                  toast.success("تمت الإضافة");
                }
              }}
            >
              <Plus className="size-4" /> إضافة قسم
            </Button>
          </div>
          </Panel>
          <Panel id="cat-general" title="القسم العام" desc="صورة وأيقونة قسم «العام» الذي يجمع المنتجات بلا قسم">
            <div className="grid gap-4 sm:grid-cols-2">
              <FileField
                label="صورة القسم العام"
                accept="image/*"
                folder="categories"
                value={store["general_image_url"] ?? settings.data?.["general_image_url"] ?? ""}
                onChange={(url) => setStore({ ...store, general_image_url: url })}
              />
              <IconPicker
                label="أيقونة القسم العام"
                value={store["general_icon"] ?? settings.data?.["general_icon"] ?? ""}
                onChange={(v) => setStore({ ...store, general_icon: v })}
              />
              <Button
                className="sm:col-span-2"
                onClick={async () => {
                  const rows = [
                    {
                      key: "general_image_url",
                      value: store["general_image_url"] ?? settings.data?.["general_image_url"] ?? "",
                    },
                    {
                      key: "general_icon",
                      value: store["general_icon"] ?? settings.data?.["general_icon"] ?? "",
                    },
                  ];
                  const { error } = await supabase.from("store_settings").upsert(rows);
                  if (error) toast.error(error.message);
                  else {
                    invalidate(["store_settings"]);
                    toast.success("تم الحفظ");
                  }
                }}
              >
                حفظ القسم العام
              </Button>
            </div>
          </Panel>

          <Panel id="cat-list" title="قائمة الأقسام" desc="حذف الأقسام غير المستخدمة">
          <div className="space-y-3">
            {(categories.data ?? []).map((c) => (

              <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3">
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sand">
                  <CategoryIcon icon={c.icon} imageUrl={c.image_url} fallback={c.name_ar.charAt(0)} />
                </span>
                <span className="min-w-[8rem] flex-1 text-sm font-medium">
                  {c.parent_id ? "— " : ""}
                  {c.name_ar}
                </span>
                <div className="w-44">
                  <IconPicker
                    label="الأيقونة"
                    value={c.icon ?? ""}
                    onChange={async (v) => {
                      const { error } = await supabase
                        .from("categories")
                        .update({ icon: v })
                        .eq("id", c.id);
                      if (error) toast.error(error.message);
                      else invalidate(["categories"]);
                    }}
                  />
                </div>
                <div className="w-60">
                  <FileField
                    label="الصورة"
                    accept="image/*"
                    folder="categories"
                    value={c.image_url ?? ""}
                    onChange={async (url) => {
                      const { error } = await supabase
                        .from("categories")
                        .update({ image_url: url || null })
                        .eq("id", c.id);
                      if (error) toast.error(error.message);
                      else invalidate(["categories"]);
                    }}
                  />
                </div>
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
          <Panel id="banner-new" title="إضافة خبر / بانر" desc="يظهر في شريط الأخبار المتحرك أعلى الصفحة الرئيسية">
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
              <Label>العنوان بالإنكليزية</Label>
              <Input dir="ltr" value={bform.title_en} onChange={(e) => setBform({ ...bform, title_en: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>الوصف بالعربية</Label>
              <Textarea
                rows={2}
                value={bform.description_ar}
                onChange={(e) => setBform({ ...bform, description_ar: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>الوصف بالإنكليزية</Label>
              <Textarea
                rows={2}
                dir="ltr"
                value={bform.description_en}
                onChange={(e) => setBform({ ...bform, description_en: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>الرابط عند النقر (مثال: /product/ID أو رابط خارجي)</Label>
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
                  description_ar: bform.description_ar,
                  description_en: bform.description_en,
                  link_url: bform.link_url || null,
                });
                if (error) toast.error(error.message);
                else {
                  setBform({
                    image_url: "",
                    title_ar: "",
                    title_en: "",
                    description_ar: "",
                    description_en: "",
                    link_url: "",
                  });
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
                <div className="p-3">
                  <p className="text-sm font-semibold">{b.title_ar || "—"}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{b.description_ar}</p>
                </div>
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
            <div className="space-y-2 sm:col-span-3">
              <Label>تاريخ وساعة الانتهاء (اختياري)</Label>
              <Input
                type="datetime-local"
                dir="ltr"
                value={couponForm.expires_at}
                onChange={(e) => setCouponForm({ ...couponForm, expires_at: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                يتوقف الكوبون تلقائياً بعد هذا الوقت.
              </p>
            </div>
            <Button
              className="sm:col-span-3"
              disabled={!couponForm.code}
              onClick={async () => {
                try {
                  await addCoupon({
                    data: {
                      code: couponForm.code,
                      discount_type: couponForm.discount_type as "fixed" | "percent",
                      discount_value: Number(couponForm.discount_value) || 0,
                      expires_at: couponForm.expires_at || null,
                    },
                  });
                  setCouponForm({ code: "", discount_type: "fixed", discount_value: 0, expires_at: "" });
                  toast.success("تمت الإضافة وإرسال إشعار للزبائن");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "خطأ");
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
                <Label>البراند / الماركة</Label>
                <Input
                  value={solarForm.brand}
                  onChange={(e) => setSolarForm({ ...solarForm, brand: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>الفئة</Label>
                <Select
                  value={solarForm.tier}
                  onValueChange={(v) => setSolarForm({ ...solarForm, tier: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="economy">اقتصادي</SelectItem>
                    <SelectItem value="mid">متوسط</SelectItem>
                    <SelectItem value="pro">احترافي</SelectItem>
                  </SelectContent>
                </Select>
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
                  className="grid grid-cols-[minmax(0,1fr)_7rem_6rem_auto] items-center gap-2 rounded-xl border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {c.name_ar}
                      {c.brand ? ` — ${c.brand}` : ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground" dir="ltr">
                      {c.kind === "panel"
                        ? `${c.capacity}W`
                        : c.kind === "battery"
                          ? `${c.capacity}Ah / ${c.voltage}V`
                          : `${c.capacity}kW`}
                      {` · ${TIER_LABEL[c.tier] ?? c.tier}`}
                    </p>
                  </div>
                  <Select
                    value={c.tier}
                    onValueChange={async (v) => {
                      await supabase.from("solar_components").update({ tier: v }).eq("id", c.id);
                      invalidate(["solar_components"]);
                    }}
                  >
                    <SelectTrigger aria-label="الفئة">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="economy">اقتصادي</SelectItem>
                      <SelectItem value="mid">متوسط</SelectItem>
                      <SelectItem value="pro">احترافي</SelectItem>
                    </SelectContent>
                  </Select>
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

          <Panel
            id="set-pricing"
            title="قواعد التسعير الديناميكي"
            desc="شرائح حسب السعر: نسبة أعلى للأسعار المنخفضة وأقل للمرتفعة، مع التقريب لأقرب 250 دينار"
          >
            <PricingTiersEditor
              initialValue={settings.data?.["price_tiers"]}
              legacyPercent={Number(settings.data?.["price_markup_percent"] ?? 0) || 0}
              onChange={(json) => setStore((s) => ({ ...s, price_tiers: json }))}
            />
          </Panel>


          <CropSettingsPanel />



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
                invalidate(["products"]);

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
