import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { toLatinDigits } from "@/lib/format";

/**
 * Numeric text field that accepts Arabic-Indic digits and always stores/shows
 * Latin digits. Uses type="text" so RTL keyboards never get rejected.
 */
export function NumberField({
  value,
  onValueChange,
  allowEmpty = false,
  className,
  ...rest
}: {
  value: number | null;
  onValueChange: (v: number | null) => void;
  allowEmpty?: boolean;
  className?: string;
  "aria-label"?: string;
  placeholder?: string;
  id?: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));

  useEffect(() => {
    const current = Number(toLatinDigits(text).replace(/[^\d.-]/g, ""));
    if (value == null && text !== "") setText("");
    else if (value != null && current !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      {...rest}
      type="text"
      inputMode="decimal"
      dir="ltr"
      className={className}
      value={text}
      onChange={(e) => {
        const clean = toLatinDigits(e.target.value).replace(/[^\d.]/g, "");
        setText(clean);
        if (clean === "") onValueChange(allowEmpty ? null : 0);
        else if (!clean.endsWith(".")) onValueChange(Number(clean));
      }}
      onBlur={() => {
        if (text === "") return;
        const n = Number(text);
        setText(Number.isFinite(n) ? String(n) : "");
      }}
    />
  );
}
