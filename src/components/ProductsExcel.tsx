import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { downloadWorkbook } from "@/lib/xlsx-download";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { supabase } from "@/integrations/supabase/client";

type Category = { id: string; name_ar: string; name_en: string };
type Product = {
  id: string;
  sku: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  price: number;
  discount_price: number | null;
  stock_qty: number;
  is_featured: boolean;
  image_url: string | null;
  catalog_pdf_url: string | null;
  category_id: string | null;
};

/** Column headers of the import/export sheet — must stay in sync with rowToProduct(). */
const HEADERS = [
  "sku",
  "name_ar",
  "name_en",
  "description_ar",
  "description_en",
  "price",
  "discount_price",
  "stock_qty",
  "is_featured",
  "category",
  "image_url",
  "catalog_pdf_url",
] as const;

const HEADERS_AR: Record<(typeof HEADERS)[number], string> = {
  sku: "الرمز",
  name_ar: "الاسم بالعربية",
  name_en: "الاسم بالإنكليزية",
  description_ar: "الوصف بالعربية",
  description_en: "الوصف بالإنكليزية",
  price: "السعر",
  discount_price: "سعر الخصم",
  stock_qty: "الكمية",
  is_featured: "مميز (نعم/لا)",
  category: "القسم",
  image_url: "رابط الصورة",
  catalog_pdf_url: "رابط الكتالوج PDF",
};

function buildSheet(rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...HEADERS] });
  // Second header row in Arabic as a guide (inserted right under the keys row).
  XLSX.utils.sheet_add_aoa(ws, [HEADERS.map((h) => HEADERS_AR[h])], { origin: "A2" });
  ws["!cols"] = HEADERS.map(() => ({ wch: 20 }));
  return ws;
}

function download(ws: XLSX.WorkSheet, filename: string) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "products");
  downloadWorkbook(wb, filename);
}

function truthy(v: unknown) {
  const s = String(v ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "نعم", "مميز"].includes(s);
}

function num(v: unknown) {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function ProductsExcel({
  categories,
  products,
  onDone,
}: {
  categories: Category[];
  products: Product[];
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ phase: string; done: number; total: number } | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);


  const exportTemplate = () => {
    const example = {
      sku: "SKU-001",
      name_ar: "مثال: لوح طاقة شمسية 550 واط",
      name_en: "Example: Solar panel 550W",
      description_ar: "وصف مختصر",
      description_en: "Short description",
      price: 250000,
      discount_price: "",
      stock_qty: 10,
      is_featured: "لا",
      category: categories[0] ? categories[0].name_ar : "الإلكترونيات",
      image_url: "",
      catalog_pdf_url: "",
    };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, buildSheet([example]), "products");
    const guide = XLSX.utils.aoa_to_sheet([
      ["الأقسام المتاحة (انسخ الاسم كما هو في عمود القسم)"],
      ...categories.map((c) => [c.name_ar, c.name_en]),
    ]);
    guide["!cols"] = [{ wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, guide, "categories");
    downloadWorkbook(wb, "smarttech-products-template.xlsx");
  };

  const exportCurrent = () => {
    const byId = new Map(categories.map((c) => [c.id, c.name_ar]));
    const rows = products.map((p) => ({
      sku: p.sku,
      name_ar: p.name_ar,
      name_en: p.name_en,
      description_ar: p.description_ar,
      description_en: p.description_en,
      price: p.price,
      discount_price: p.discount_price ?? "",
      stock_qty: p.stock_qty,
      is_featured: p.is_featured ? "نعم" : "لا",
      category: (p.category_id && byId.get(p.category_id)) || "",
      image_url: p.image_url ?? "",
      catalog_pdf_url: p.catalog_pdf_url ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows, { header: [...HEADERS] });
    ws["!cols"] = HEADERS.map(() => ({ wch: 20 }));
    download(ws, "smarttech-products.xlsx");
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    setProgress({ phase: "قراءة الملف…", done: 0, total: 0 });
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === "products") ?? wb.SheetNames[0]!;
      setProgress({ phase: "تحليل الصفوف…", done: 0, total: 0 });
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]!, {
        defval: "",
      });

      const catByName = new Map<string, string>();
      categories.forEach((c) => {
        catByName.set(c.name_ar.trim().toLowerCase(), c.id);
        if (c.name_en) catByName.set(c.name_en.trim().toLowerCase(), c.id);
      });
      const bySku = new Map(products.filter((p) => p.sku).map((p) => [p.sku.trim().toLowerCase(), p.id]));

      const inserts: Record<string, unknown>[] = [];
      const updates: { id: string; values: Record<string, unknown> }[] = [];
      let skipped = 0;

      for (const row of raw) {
        const nameAr = String(row["name_ar"] ?? "").trim();
        // Skip the Arabic guide row and empty lines.
        if (!nameAr || nameAr === HEADERS_AR.name_ar) {
          skipped++;
          continue;
        }
        const catName = String(row["category"] ?? "").trim().toLowerCase();
        const discount = String(row["discount_price"] ?? "").trim();
        const values = {
          sku: String(row["sku"] ?? "").trim(),
          name_ar: nameAr,
          name_en: String(row["name_en"] ?? "").trim(),
          description_ar: String(row["description_ar"] ?? "").trim(),
          description_en: String(row["description_en"] ?? "").trim(),
          price: num(row["price"]),
          discount_price: discount ? num(discount) : null,
          stock_qty: num(row["stock_qty"]),
          is_featured: truthy(row["is_featured"]),
          category_id: catByName.get(catName) ?? null,
          image_url: String(row["image_url"] ?? "").trim() || null,
          catalog_pdf_url: String(row["catalog_pdf_url"] ?? "").trim() || null,
        };
        const existing = values.sku ? bySku.get(values.sku.toLowerCase()) : undefined;
        if (existing) updates.push({ id: existing, values });
        else inserts.push(values);
      }

      if (!inserts.length && !updates.length) {
        toast.error("لم يتم العثور على صفوف صالحة في الملف");
        return;
      }

      const total = inserts.length + updates.length;
      let done = 0;
      const tick = (n: number, phase: string) => {
        done += n;
        setProgress({ phase, done, total });
      };

      setProgress({ phase: "رفع المنتجات الجديدة…", done: 0, total });
      for (let i = 0; i < inserts.length; i += 200) {
        const chunk = inserts.slice(i, i + 200);
        const { error } = await supabase.from("products").insert(chunk as never);
        if (error) throw error;
        tick(chunk.length, "رفع المنتجات الجديدة…");
        // Yield so the progress bar can repaint between chunks.
        await new Promise((r) => setTimeout(r, 0));
      }
      for (const u of updates) {
        const { error } = await supabase.from("products").update(u.values as never).eq("id", u.id);
        if (error) throw error;
        tick(1, "تحديث المنتجات الموجودة…");
      }

      toast.success(
        `تم الاستيراد: ${inserts.length} جديد، ${updates.length} محدّث${skipped ? `، ${skipped} متجاهل` : ""}`,
      );
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل استيراد الملف");
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };


  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <h2 className="text-base font-bold">استيراد وتصدير المنتجات (Excel)</h2>
      <p className="text-xs text-muted-foreground">
        نزّل النموذج الفارغ، املأ الصفوف، ثم ارفع الملف. الصفوف التي تحمل رمز SKU موجود مسبقاً سيتم
        تحديثها بدل تكرارها.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={exportTemplate}>
          <Download className="size-4" />
          تنزيل نموذج فارغ
        </Button>
        <Button type="button" variant="outline" onClick={exportCurrent} disabled={!products.length}>
          <FileSpreadsheet className="size-4" />
          تصدير المنتجات الحالية
        </Button>
        <Button type="button" disabled={busy} asChild>
          <label className={busy ? "pointer-events-none opacity-70" : "cursor-pointer"}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
            {busy ? "جارٍ الرفع…" : "رفع ملف Excel"}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </label>
        </Button>
      </div>
      {progress && (
        <div className="space-y-2 rounded-xl border bg-muted/40 p-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>{progress.phase}</span>
            <span dir="ltr">
              {progress.total
                ? `${progress.done} / ${progress.total} (${Math.round((progress.done / progress.total) * 100)}%)`
                : "…"}
            </span>
          </div>
          <Progress value={progress.total ? (progress.done / progress.total) * 100 : undefined} />
          <p className="text-[11px] text-muted-foreground">
            لا تغلق الصفحة حتى انتهاء الرفع — الملفات الكبيرة قد تستغرق عدة دقائق.
          </p>
        </div>
      )}

    </div>
  );
}
