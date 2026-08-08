import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ordersProfit } from "@/lib/admin.functions";
import { statusLabel } from "@/lib/format";
import { downloadWorkbook } from "@/lib/xlsx-download";

type OrderRecord = Record<string, any>;

/** Admin tool: export a profit report (per order + per item) to Excel. */
export function ProfitsExcel({
  orders,
  selected,
  onToggleMode,
  selectionMode,
}: {
  orders: OrderRecord[];
  selected: string[];
  selectionMode: boolean;
  onToggleMode: (v: boolean) => void;
}) {
  const run = useServerFn(ordersProfit);
  const [busy, setBusy] = useState(false);

  const ids = selectionMode ? selected : orders.map((o) => String(o["id"]));

  const exportNow = async () => {
    if (!ids.length) {
      toast.error("لا توجد طلبات محددة");
      return;
    }
    setBusy(true);
    try {
      const rows = (await run({ data: { order_ids: ids } })) as any[];
      const summary = rows.map((r) => ({
        "رقم الطلب": r.order_number,
        "الزبون": r.customer_name,
        "الهاتف": r.phone,
        "الحالة": statusLabel(r.status, "ar"),
        "التاريخ": new Date(r.created_at).toLocaleString("ar-IQ-u-nu-latn"),
        "كلفة المواد": r.total_base,
        "مجموع البيع": r.total_sell,
        "الربح": r.total_profit,
        "نسبة الربح %": r.percent,
        "إجمالي الفاتورة": r.total_amount,
      }));
      const details = rows.flatMap((r) =>
        r.lines.map((l: any) => ({
          "رقم الطلب": r.order_number,
          "المادة": l.name,
          "العدد": l.quantity,
          "السعر الأصلي": l.known ? l.base_price : "",
          "سعر البيع": l.sell_price,
          "الربح": l.profit_total,
        })),
      );
      const totals = rows.reduce(
        (a, r) => ({
          base: a.base + r.total_base,
          sell: a.sell + r.total_sell,
          profit: a.profit + r.total_profit,
        }),
        { base: 0, sell: 0, profit: 0 },
      );
      summary.push({
        "رقم الطلب": "الإجمالي" as never,
        "الزبون": "",
        "الهاتف": "",
        "الحالة": "",
        "التاريخ": "",
        "كلفة المواد": totals.base,
        "مجموع البيع": totals.sell,
        "الربح": totals.profit,
        "نسبة الربح %": totals.base > 0 ? Math.round((totals.profit / totals.base) * 1000) / 10 : 0,
        "إجمالي الفاتورة": "" as never,
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "ملخص الأرباح");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(details), "تفاصيل المواد");
      downloadWorkbook(wb, `smarttech-profits-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`تم تصدير ${rows.length} طلبية`);
    } catch {
      toast.error("تعذر تصدير تقرير الأرباح");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3">
      <label className="flex items-center gap-2 text-xs font-semibold">
        <Checkbox
          checked={selectionMode}
          onCheckedChange={(v) => onToggleMode(Boolean(v))}
        />
        تحديد طلبيات معيّنة
      </label>
      <Button size="sm" disabled={busy} onClick={exportNow}>
        <FileSpreadsheet className="me-1 size-4" />
        {busy
          ? "جاري التصدير..."
          : selectionMode
            ? `تصدير أرباح المحدد (${selected.length})`
            : `تصدير أرباح كل الطلبات (${orders.length})`}
      </Button>
    </div>
  );
}
