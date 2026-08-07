import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { supabase } from "@/integrations/supabase/client";

type Category = { id: string; name_ar: string; name_en: string; parent_id: string | null };

const HEADERS = ["name_ar", "name_en", "parent_ar"] as const;
const HEADERS_AR: Record<(typeof HEADERS)[number], string> = {
  name_ar: "اسم القسم بالعربية",
  name_en: "اسم القسم بالإنكليزية",
  parent_ar: "القسم الأب (اتركه فارغاً للقسم الرئيسي)",
};

function buildSheet(rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...HEADERS] });
  XLSX.utils.sheet_add_aoa(ws, [HEADERS.map((h) => HEADERS_AR[h])], { origin: "A2" });
  ws["!cols"] = HEADERS.map(() => ({ wch: 30 }));
  return ws;
}

export function CategoriesExcel({
  categories,
  onDone,
}: {
  categories: Category[];
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ phase: string; done: number; total: number } | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const exportTemplate = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      buildSheet([
        { name_ar: "إلكترونيات", name_en: "Electronics", parent_ar: "" },
        { name_ar: "هواتف", name_en: "Phones", parent_ar: "إلكترونيات" },
      ]),
      "categories",
    );
    XLSX.writeFile(wb, "smarttech-categories-template.xlsx");
  };

  const exportCurrent = () => {
    const byId = new Map(categories.map((c) => [c.id, c.name_ar]));
    const rows = categories.map((c) => ({
      name_ar: c.name_ar,
      name_en: c.name_en,
      parent_ar: (c.parent_id && byId.get(c.parent_id)) || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows, { header: [...HEADERS] });
    ws["!cols"] = HEADERS.map(() => ({ wch: 30 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "categories");
    XLSX.writeFile(wb, "smarttech-categories.xlsx");
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    setProgress({ phase: "قراءة الملف…", done: 0, total: 0 });
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheetName =
        wb.SheetNames.find((n) => n.toLowerCase() === "categories") ?? wb.SheetNames[0]!;
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]!, {
        defval: "",
      });

      const byName = new Map<string, string>();
      categories.forEach((c) => {
        byName.set(c.name_ar.trim().toLowerCase(), c.id);
        if (c.name_en) byName.set(c.name_en.trim().toLowerCase(), c.id);
      });

      type Row = { name_ar: string; name_en: string; parent: string };
      const rows: Row[] = [];
      for (const r of raw) {
        const nameAr = String(r["name_ar"] ?? "").trim();
        if (!nameAr || nameAr === HEADERS_AR.name_ar) continue;
        rows.push({
          name_ar: nameAr,
          name_en: String(r["name_en"] ?? "").trim(),
          parent: String(r["parent_ar"] ?? "").trim(),
        });
      }
      if (!rows.length) {
        toast.error("لم يتم العثور على صفوف صالحة في الملف");
        return;
      }

      // Roots first so children can resolve their parent by name.
      const roots = rows.filter((r) => !r.parent);
      const kids = rows.filter((r) => r.parent);
      const total = rows.length;
      let done = 0;
      let created = 0;
      let skipped = 0;

      const insertPass = async (list: Row[], phase: string) => {
        for (const r of list) {
          const key = r.name_ar.toLowerCase();
          if (byName.has(key)) {
            skipped++;
          } else {
            const parentId = r.parent ? (byName.get(r.parent.toLowerCase()) ?? null) : null;
            const { data, error } = await supabase
              .from("categories")
              .insert({ name_ar: r.name_ar, name_en: r.name_en, parent_id: parentId } as never)
              .select("id")
              .single();
            if (error) throw error;
            byName.set(key, (data as { id: string }).id);
            if (r.name_en) byName.set(r.name_en.toLowerCase(), (data as { id: string }).id);
            created++;
          }
          done++;
          setProgress({ phase, done, total });
        }
      };

      await insertPass(roots, "إضافة الأقسام الرئيسية…");
      await insertPass(kids, "إضافة الأقسام الفرعية…");

      toast.success(`تم الاستيراد: ${created} قسم جديد${skipped ? `، ${skipped} موجود مسبقاً` : ""}`);
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
      <h2 className="text-base font-bold">استيراد وتصدير الأقسام (Excel)</h2>
      <p className="text-xs text-muted-foreground">
        الأسماء فقط: اسم القسم بالعربية والإنكليزية، واسم القسم الأب للأقسام الفرعية (اتركه فارغاً
        للقسم الرئيسي).
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={exportTemplate}>
          <Download className="size-4" />
          تنزيل نموذج فارغ
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={exportCurrent}
          disabled={!categories.length}
        >
          <FileSpreadsheet className="size-4" />
          تصدير الأقسام الحالية
        </Button>
        <Button type="button" disabled={busy} asChild>
          <label className={busy ? "pointer-events-none opacity-70" : "cursor-pointer"}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-4" />
            )}
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
        </div>
      )}
    </div>
  );
}
