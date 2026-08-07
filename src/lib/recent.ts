const KEY = "recently_viewed_v1";
const MAX = 8;

export function pushRecent(id: string) {
  if (typeof window === "undefined") return;
  try {
    const list = getRecent().filter((x) => x !== id);
    localStorage.setItem(KEY, JSON.stringify([id, ...list].slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function getRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
