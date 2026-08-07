import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Ctx = {
  ids: string[];
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  remove: (id: string) => void;
};

const WishlistContext = createContext<Ctx | null>(null);
const KEY = "wishlist_v1";

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setIds(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(ids));
  }, [ids, ready]);

  const value = useMemo<Ctx>(
    () => ({
      ids,
      has: (id) => ids.includes(id),
      toggle: (id) => setIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [id, ...prev])),
      remove: (id) => setIds((prev) => prev.filter((p) => p !== id)),
    }),
    [ids],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used inside WishlistProvider");
  return ctx;
}
