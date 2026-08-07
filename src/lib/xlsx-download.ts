import * as XLSX from "xlsx";

/**
 * Downloads a workbook reliably, including inside sandboxed preview iframes
 * where XLSX.writeFile's implicit anchor click can be blocked.
 */
export function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    window.open(url, "_blank", "noopener");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
