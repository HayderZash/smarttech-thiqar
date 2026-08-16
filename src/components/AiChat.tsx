import { Bot, Send, ShoppingCart, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/lib/cart";
import { formatIQD } from "@/lib/format";

type AiProduct = {
  id: string;
  name: string;
  sku: string;
  price: number;
  image_url: string | null;
  stock_qty: number;
  url: string;
};

type Turn = {
  role: "user" | "assistant";
  content: string;
  products?: AiProduct[];
  failed?: boolean;
};

const STORAGE_KEY = "smarttech_ai_chat_v1";

const WELCOME: Turn = {
  role: "assistant",
  content: "أهلاً بك في SmartTech 👋 اسألني عن أي منتج (مثلاً: ريلي ٢٤ أمبير) وسأجده لك.",
};

/** Reads the saved conversation (kept in this browser only). */
function loadTurns(): Turn[] {
  if (typeof window === "undefined") return [WELCOME];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Turn[]) : null;
    return Array.isArray(parsed) && parsed.length ? parsed : [WELCOME];
  } catch {
    return [WELCOME];
  }
}

/** AI shopping assistant with product cards, saved context and add-to-cart. */
export function AiChat({ endpoint = "/api/public/ai/chat" }: { endpoint?: string }) {
  const cart = useCart();
  const [turns, setTurns] = useState<Turn[]>(loadTurns);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, busy]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(turns.slice(-40)));
    } catch {
      /* storage full or blocked — conversation stays in memory */
    }
  }, [turns]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  const ask = async (override?: string) => {
    const content = (override ?? text).trim();
    if (!content || busy) return;
    const next: Turn[] = [...turns, { role: "user", content }];
    setTurns(next);
    setText("");
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((t) => ({ role: t.role, content: t.content })).slice(-12),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        reply?: string;
        products?: AiProduct[];
        error?: string;
      };
      if (!res.ok || json.error) throw new Error(json.error ?? "تعذر الاتصال بالمساعد");
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: json.reply ?? "", products: json.products ?? [] },
      ]);
    } catch {
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          failed: true,
          content:
            "تعذّر الوصول إلى خدمة الذكاء الاصطناعي حالياً 😔 جرّب مرة أخرى بعد قليل، أو راسل إدارة المتجر مباشرة من زر المحادثة.",
        },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const lastUser = [...turns].reverse().find((t) => t.role === "user")?.content ?? "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <p className="text-[11px] text-muted-foreground">المحادثة محفوظة على جهازك</p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-[11px]"
          onClick={() => setTurns([WELCOME])}
        >
          <Trash2 className="size-3" />
          محادثة جديدة
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <div
              className={
                t.role === "user"
                  ? "ms-auto max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : t.failed
                    ? "me-auto max-w-[90%] rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    : "me-auto max-w-[90%] rounded-2xl bg-muted px-3 py-2 text-sm"
              }
            >
              <p className="whitespace-pre-wrap">{t.content}</p>
              {t.failed && lastUser && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 rounded-full text-[11px]"
                  disabled={busy}
                  onClick={() => void ask(lastUser)}
                >
                  إعادة المحاولة
                </Button>
              )}
            </div>
            {!!t.products?.length && (
              <div className="grid grid-cols-2 gap-2">
                {t.products.map((p) => (
                  <div key={p.id} className="rounded-2xl border bg-card p-2">
                    <Link to="/product/$id" params={{ id: p.id }} className="block">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="mb-1 h-24 w-full rounded-xl object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="mb-1 h-24 w-full rounded-xl bg-muted" />
                      )}
                      <p className="line-clamp-2 text-xs font-semibold">{p.name}</p>
                      <p className="mt-1 text-xs font-bold text-primary">{formatIQD(p.price)}</p>
                    </Link>
                    <Button
                      size="sm"
                      className="mt-2 h-7 w-full rounded-full text-[11px]"
                      onClick={() => {
                        cart.add({
                          id: p.id,
                          name_ar: p.name,
                          name_en: p.name,
                          price: p.price,
                          original_price: p.price,
                          image_url: p.image_url,
                        });
                        toast.success("تمت الإضافة إلى السلة");
                      }}
                    >
                      <ShoppingCart className="size-3" />
                      أضف للسلة
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Bot className="size-4 animate-pulse" /> المساعد يكتب...
          </p>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex shrink-0 items-end gap-2 border-t p-2">
        <Textarea
          ref={inputRef}
          value={text}
          rows={1}
          maxLength={1000}
          placeholder="اسأل عن منتج أو مواصفات..."
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask();
            }
          }}
          className="min-h-10 flex-1 resize-none"
        />
        <Button size="icon" disabled={busy} onClick={() => void ask()}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
