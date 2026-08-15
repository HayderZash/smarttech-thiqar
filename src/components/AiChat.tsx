import { Bot, Send, ShoppingCart } from "lucide-react";
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

type Turn = { role: "user" | "assistant"; content: string; products?: AiProduct[] };

/** AI shopping assistant with product cards and add-to-cart. */
export function AiChat({ endpoint = "/api/public/ai/chat" }: { endpoint?: string }) {
  const cart = useCart();
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      content: "أهلاً بك في SmartTech 👋 اسألني عن أي منتج (مثلاً: ريلي ٢٤ أمبير) وسأجده لك.",
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns.length, busy]);

  const ask = async () => {
    const content = text.trim();
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
      const json = (await res.json()) as {
        reply?: string;
        products?: AiProduct[];
        error?: string;
      };
      if (!res.ok || json.error) throw new Error(json.error ?? "تعذر الاتصال بالمساعد");
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: json.reply ?? "", products: json.products ?? [] },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر الاتصال بالمساعد");
      setTurns((prev) => prev.slice(0, -1));
      setText(content);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <div
              className={
                t.role === "user"
                  ? "ms-auto max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "me-auto max-w-[90%] rounded-2xl bg-muted px-3 py-2 text-sm"
              }
            >
              <p className="whitespace-pre-wrap">{t.content}</p>
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

      <div className="flex items-end gap-2 border-t p-2">
        <Textarea
          value={text}
          rows={1}
          maxLength={1000}
          placeholder="اسأل عن منتج أو مواصفات..."
          onChange={(e) => setText(e.target.value)}
          className="min-h-10 flex-1 resize-none"
        />
        <Button size="icon" disabled={busy} onClick={() => void ask()}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
