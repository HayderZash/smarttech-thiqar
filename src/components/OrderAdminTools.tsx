import { useServerFn } from "@tanstack/react-start";
import { Calculator, MessageCircle, Printer } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import storeLogo from "@/lib/store-logo";
import { Button } from "@/components/ui/button";
import { orderProfit } from "@/lib/admin.functions";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatIQD, statusLabel, whatsappLink } from "@/lib/format";

type ProfitLine = {
  id: string;
  name: string;
  quantity: number;
  base_price: number;
  sell_price: number;
  profit_unit: number;
  profit_total: number;
  percent: number;
  known: boolean;
};
type ProfitReport = {
  lines: ProfitLine[];
  total_base: number;
  total_sell: number;
  total_profit: number;
  percent: number;
};

type OrderRecord = Record<string, any>;

const money = (n: number) => formatIQD(Number(n) || 0, "ar");

/** Builds the A4 invoice HTML (previewed in-app, then printed / saved as PDF). */
function invoiceHtml(order: OrderRecord, settings: Record<string, string>) {
  const items = (order["order_items"] ?? []).filter((i: OrderRecord) => !i["is_unavailable"]);
  const logo = settings["logo_url"] || storeLogo.url;
  const name = settings["store_name_ar"] || "SmartTech";
  const phone = settings["store_phone"] || settings["support_whatsapp"] || "";
  const address = settings["store_address"] || "";
  const email = settings["store_email"] || "";
  const rows = items
    .map(
      (it: OrderRecord, idx: number) => `<tr>
        <td>${idx + 1}</td>
        <td class="name">${String(it["product_name"] ?? "")}</td>
        <td>${Number(it["quantity"])}</td>
        <td>${money(Number(it["unit_price"]))}</td>
        <td>${money(Number(it["unit_price"]) * Number(it["quantity"]))}</td>
      </tr>`,
    )
    .join("");
  const subtotal = Number(order["subtotal"] ?? 0);
  const discount = Number(order["discount_amount"] ?? 0);
  const shipping = Number(order["shipping_fee"] ?? 0);
  const total = Number(order["total_amount"] ?? 0);

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
  <title>فاتورة #${order["order_number"]}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; color:#12261d; margin:0; }
    .head { display:flex; align-items:center; justify-content:space-between; gap:16px;
      border-bottom:3px solid #0f7a52; padding-bottom:12px; }
    .brand { display:flex; align-items:center; gap:12px; }
    .brand img { width:74px; height:74px; object-fit:contain; }
    .brand h1 { margin:0; font-size:22px; color:#0f7a52; }
    .brand p { margin:2px 0 0; font-size:12px; color:#4b5b53; }
    .meta { text-align:left; font-size:12px; line-height:1.8; }
    .meta b { color:#0f7a52; }
    h2 { font-size:15px; margin:18px 0 8px; color:#0f7a52; }
    .info { font-size:13px; line-height:1.9; background:#f4f8f5; border:1px solid #dbe8e0;
      border-radius:8px; padding:10px 12px; }
    table { width:100%; border-collapse:collapse; margin-top:8px; font-size:13px; }
    th, td { border:1px solid #cfe0d6; padding:7px 8px; text-align:center; }
    th { background:#0f7a52; color:#fff; font-weight:600; }
    td.name { text-align:right; }
    tbody tr:nth-child(even) { background:#f7fbf8; }
    .totals { margin-top:12px; margin-inline-start:auto; width:280px; font-size:13px; }
    .totals td { border:none; padding:5px 8px; text-align:start; }
    .totals tr.grand td { border-top:2px solid #0f7a52; font-size:16px; font-weight:700; color:#0f7a52; }
    footer { margin-top:28px; text-align:center; font-size:11px; color:#6b7a72;
      border-top:1px solid #dbe8e0; padding-top:10px; }
  </style></head><body>
  <div class="head">
    <div class="brand">
      <img src="${logo}" alt="${name}" />
      <div><h1>${name}</h1>
      <p>${address}</p>
      <p>${phone}${email ? " · " + email : ""}</p></div>
    </div>
    <div class="meta">
      <div><b>فاتورة رقم:</b> #${order["order_number"]}</div>
      <div><b>التاريخ:</b> ${new Date(order["created_at"]).toLocaleString("ar-IQ-u-nu-latn")}</div>
      <div><b>الحالة:</b> ${statusLabel(String(order["status"]), "ar")}</div>
    </div>
  </div>

  <h2>معلومات الزبون</h2>
  <div class="info">
    <div><b>الاسم:</b> ${order["customer_name"] ?? ""}</div>
    <div><b>الهاتف:</b> ${order["phone"] ?? ""}</div>
    <div><b>العنوان:</b> ${order["governorate_name"] ?? ""} — ${order["landmark"] ?? ""}</div>
    ${order["preferred_delivery_time"] ? `<div><b>وقت التسليم المفضل:</b> ${order["preferred_delivery_time"]}</div>` : ""}
  </div>

  <h2>تفاصيل المواد</h2>
  <table>
    <thead><tr><th style="width:36px">#</th><th>المادة</th><th style="width:60px">العدد</th>
      <th style="width:110px">سعر القطعة</th><th style="width:120px">السعر الكلي</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <table class="totals">
    <tr><td>المجموع الفرعي</td><td>${money(subtotal)}</td></tr>
    ${discount ? `<tr><td>الخصم${order["coupon_code"] ? ` (${order["coupon_code"]})` : ""}</td><td>- ${money(discount)}</td></tr>` : ""}
    <tr><td>أجور التوصيل</td><td>${money(shipping)}</td></tr>
    <tr class="grand"><td>الإجمالي</td><td>${money(total)}</td></tr>
  </table>

  <footer>شكراً لتسوقك من ${name} — الدفع عند الاستلام. للاستفسار: ${phone}</footer>
  </body></html>`;

  return html;
}

/** Short WhatsApp text version of the invoice. */
function invoiceText(order: OrderRecord, settings: Record<string, string>) {
  const name = settings["store_name_ar"] || "SmartTech";
  const items = (order["order_items"] ?? []).filter((i: OrderRecord) => !i["is_unavailable"]);
  const lines = items
    .map(
      (it: OrderRecord, i: number) =>
        `${i + 1}. ${it["product_name"]} × ${Number(it["quantity"])} = ${money(Number(it["unit_price"]) * Number(it["quantity"]))}`,
    )
    .join("\n");
  return [
    `🧾 فاتورة ${name}`,
    `رقم الطلب: #${order["order_number"]}`,
    `الاسم: ${order["customer_name"] ?? ""}`,
    `العنوان: ${order["governorate_name"] ?? ""} — ${order["landmark"] ?? ""}`,
    "",
    lines,
    "",
    `المجموع الفرعي: ${money(Number(order["subtotal"] ?? 0))}`,
    Number(order["discount_amount"] ?? 0) ? `الخصم: -${money(Number(order["discount_amount"]))}` : "",
    `أجور التوصيل: ${money(Number(order["shipping_fee"] ?? 0))}`,
    `الإجمالي: ${money(Number(order["total_amount"] ?? 0))}`,
    "",
    "الدفع عند الاستلام. شكراً لتسوقك معنا 🌿",
  ]
    .filter(Boolean)
    .join("\n");
}

export function OrderAdminTools({
  order,
  settings,
}: {
  order: OrderRecord;
  settings: Record<string, string>;
}) {
  const calc = useServerFn(orderProfit);
  const [report, setReport] = useState<ProfitReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const showProfit = ["preparing", "shipped", "completed"].includes(String(order["status"]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {showProfit && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              if (report) {
                setReport(null);
                return;
              }
              setBusy(true);
              try {
                const res = (await calc({ data: { order_id: String(order["id"]) } })) as ProfitReport;
                setReport(res);
              } catch {
                toast.error("تعذر احتساب الربح");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Calculator className="me-1 size-4" />
            {report ? "إخفاء الربح" : "احتساب قيمة الربح"}
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setPreview(true)}>
          <Printer className="me-1 size-4" />
          معاينة وطباعة الفاتورة
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a
            href={whatsappLink(String(order["phone"] ?? ""), invoiceText(order, settings))}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="me-1 size-4" />
            إرسال الفاتورة للواتساب
          </a>
        </Button>
      </div>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="flex h-[90vh] max-w-3xl flex-col p-4">
          <DialogHeader>
            <DialogTitle>معاينة الفاتورة #{String(order["order_number"])}</DialogTitle>
          </DialogHeader>
          <iframe
            ref={frameRef}
            title="invoice"
            className="min-h-0 flex-1 w-full rounded-lg border bg-white"
            srcDoc={invoiceHtml(order, settings)}
          />
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              onClick={() => {
                const win = frameRef.current?.contentWindow;
                if (!win) {
                  toast.error("تعذر فتح الطباعة");
                  return;
                }
                win.focus();
                win.print();
              }}
            >
              <Printer className="me-1 size-4" />
              طباعة / حفظ PDF
            </Button>
            <Button variant="outline" onClick={() => setPreview(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {report && (
        <div className="overflow-x-auto rounded-xl border bg-muted/30 p-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="p-1 text-start">المادة</th>
                <th className="p-1">العدد</th>
                <th className="p-1">السعر الأصلي</th>
                <th className="p-1">سعر البيع</th>
                <th className="p-1">نسبة الربح</th>
                <th className="p-1">الربح</th>
              </tr>
            </thead>
            <tbody>
              {report.lines.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="p-1 text-start">{l.name}</td>
                  <td className="p-1 text-center">{l.quantity}</td>
                  <td className="p-1 text-center">{l.known ? money(l.base_price) : "—"}</td>
                  <td className="p-1 text-center">{money(l.sell_price)}</td>
                  <td className="p-1 text-center">{l.known ? `${l.percent}%` : "—"}</td>
                  <td className="p-1 text-center font-semibold text-primary">
                    {money(l.profit_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 grid gap-1 border-t pt-2 text-xs font-semibold">
            <span>كلفة المواد الأصلية: {money(report.total_base)}</span>
            <span>مجموع البيع: {money(report.total_sell)}</span>
            <span className="text-primary">
              الربح الكلي: {money(report.total_profit)} ({report.percent}%)
            </span>
          </div>
          {report.lines.some((l) => !l.known) && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              بعض المواد لم تعد موجودة في قائمة المنتجات فلا يمكن معرفة سعرها الأصلي.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
