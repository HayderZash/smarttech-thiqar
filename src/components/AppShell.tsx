import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  LayoutGrid,
  ShoppingCart,
  ClipboardList,
  User,
  Search,
  Languages,
  MessageCircle,
  Download,
  X,
  Shield,
  Menu,
  Phone,
  Mail,
  MapPin,
  Clock,
  Facebook,
  Instagram,
  Heart,
  Tag,
  PackageSearch,
  Sun,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { useLang } from "@/lib/i18n";
import { settingsQuery } from "@/lib/queries";
import { whatsappLink } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", key: "home", icon: Home },
  { to: "/categories", key: "categories", icon: LayoutGrid },
  { to: "/cart", key: "cart", icon: ShoppingCart },
  { to: "/orders", key: "orders", icon: ClipboardList },
  { to: "/account", key: "account", icon: User },
] as const;

const EXTRA_NAV = [
  { to: "/deals", key: "dealsPage", icon: Tag },
  { to: "/wishlist", key: "wishlist", icon: Heart },
  { to: "/track", key: "trackOrder", icon: PackageSearch },
  { to: "/solar", key: "solarCalc", icon: Sun },
] as const;


function InstallBanner() {
  const { t } = useLang();
  const [prompt, setPrompt] = useState<Event & { prompt?: () => void }>();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem("pwa_dismissed") === "1";
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as Event & { prompt?: () => void });
      if (!dismissed) setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (hidden || !prompt) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-[var(--shadow-card)] md:inset-x-auto md:end-6 md:bottom-6 md:max-w-sm">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-accent-foreground">
        <Download className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{t("install")}</p>
        <p className="truncate text-xs text-muted-foreground">{t("installDesc")}</p>
      </div>
      <Button
        size="sm"
        onClick={() => {
          prompt.prompt?.();
          setHidden(true);
        }}
      >
        {t("install")}
      </Button>
      <button
        aria-label={t("later")}
        onClick={() => {
          localStorage.setItem("pwa_dismissed", "1");
          setHidden(true);
        }}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function SearchBox({ className }: { className?: string }) {
  const { t } = useLang();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  return (
    <form
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        void navigate({ to: "/search", search: { q } });
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("search")}
        className="h-10 rounded-full bg-sand ps-9"
        aria-label={t("searchTitle")}
      />
    </form>
  );
}

function SideMenu({
  settings,
  storeName,
  isAdmin,
  pathname,
}: {
  settings: Record<string, string> | undefined;
  storeName: string;
  isAdmin: boolean;
  pathname: string;
}) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const about = lang === "ar" ? settings?.["store_about_ar"] : settings?.["store_about_en"];

  const contacts = [
    { icon: Phone, value: settings?.["store_phone"], href: `tel:${settings?.["store_phone"]}` },
    {
      icon: MessageCircle,
      value: settings?.["support_whatsapp"],
      href: settings?.["support_whatsapp"] ? whatsappLink(settings["support_whatsapp"], "") : undefined,
    },
    { icon: Mail, value: settings?.["store_email"], href: `mailto:${settings?.["store_email"]}` },
    { icon: MapPin, value: settings?.["store_address"] },
    { icon: Clock, value: settings?.["working_hours"] },
  ].filter((c) => c.value);

  const socials = [
    { icon: Facebook, href: settings?.["facebook_url"], label: "Facebook" },
    { icon: Instagram, href: settings?.["instagram_url"], label: "Instagram" },
  ].filter((s) => s.href);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0 rounded-full" aria-label={t("searchTitle")}>
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side={lang === "ar" ? "right" : "left"} className="w-80 overflow-y-auto p-0">
        <SheetHeader className="border-b p-4 text-start">
          <SheetTitle className="text-base">{storeName}</SheetTitle>
          <SheetDescription className="text-xs">
            {about || (lang === "ar" ? "متجرك للإلكترونيات والطاقة ومواد البناء" : "Electronics, solar and building supplies")}
          </SheetDescription>
        </SheetHeader>

        <nav className="space-y-1 p-3">
          {NAV.map(({ to, key, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sand hover:text-foreground",
                pathname === to && "bg-primary-soft text-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {t(key)}
            </Link>
          ))}
          <div className="my-2 border-t" />
          {EXTRA_NAV.map(({ to, key, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sand hover:text-foreground",
                pathname === to && "bg-primary-soft text-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {t(key)}
            </Link>
          ))}
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sand hover:text-foreground",
                pathname === "/admin" && "bg-primary-soft text-accent-foreground",
              )}
            >
              <Shield className="size-4 shrink-0" />
              {t("admin")}
            </Link>
          )}
        </nav>

        {contacts.length > 0 && (
          <div className="space-y-2 border-t p-4">
            <h3 className="text-xs font-semibold text-muted-foreground">
              {lang === "ar" ? "تفاصيل التواصل" : "Contact details"}
            </h3>
            {contacts.map((c, i) => {
              const Row = (
                <span className="flex items-center gap-3 text-sm">
                  <c.icon className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 break-words">{c.value}</span>
                </span>
              );
              return c.href ? (
                <a key={i} href={c.href} target="_blank" rel="noopener noreferrer" className="block hover:text-primary">
                  {Row}
                </a>
              ) : (
                <div key={i}>{Row}</div>
              );
            })}
          </div>
        )}

        {socials.length > 0 && (
          <div className="flex gap-2 border-t p-4">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="flex size-10 items-center justify-center rounded-xl border text-muted-foreground hover:text-primary"
              >
                <s.icon className="size-4" />
              </a>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useLang();
  const { count } = useCart();
  const { isAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: settings } = useQuery(settingsQuery);
  const support = settings?.["support_whatsapp"];
  const storeName = (lang === "ar" ? settings?.["store_name_ar"] : settings?.["store_name_en"]) || "SmartTech";

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
          <SideMenu settings={settings} storeName={storeName} isAdmin={isAdmin} pathname={pathname} />

          <Link to="/" className="flex shrink-0 items-center gap-2">
            {settings?.["logo_url"] ? (
              <img src={settings["logo_url"]} alt="" className="size-9 rounded-xl object-cover" />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
                ن
              </span>
            )}
            <span className="hidden text-base font-bold sm:block">
              {storeName || (lang === "ar" ? "SmartTech" : "SmartTech")}
            </span>
          </Link>

          <SearchBox className="mx-auto w-full max-w-md" />

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, key, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sand hover:text-foreground",
                  pathname === to && "bg-primary-soft text-accent-foreground",
                )}
              >
                <Icon className="size-4" />
                {t(key)}
                {key === "cart" && count > 0 && (
                  <span className="absolute -top-0.5 end-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {count}
                  </span>
                )}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-sand hover:text-foreground"
              >
                <Shield className="size-4" />
                {t("admin")}
              </Link>
            )}
          </nav>

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-full"
            aria-label={t("language")}
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          >
            <Languages className="size-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">{children}</main>

      <footer className="mt-8 hidden border-t bg-sand py-6 text-center text-xs text-muted-foreground md:block">
        {storeName || "SmartTech"} © {new Date().getFullYear()}
      </footer>

      {support && (
        <a
          href={whatsappLink(support, lang === "ar" ? "مرحباً، أحتاج مساعدة" : "Hello, I need help")}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("help")}
          className="fixed bottom-24 end-4 z-40 flex size-12 items-center justify-center rounded-full bg-success text-success-foreground shadow-[var(--shadow-card)] transition-transform hover:scale-105 md:bottom-6"
        >
          <MessageCircle className="size-6" />
        </a>
      )}

      <InstallBanner />

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-stretch">
          {NAV.map(({ to, key, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground",
                  active && "text-primary",
                )}
              >
                <span className="relative">
                  <Icon className={cn("size-5", active && "stroke-[2.4]")} />
                  {key === "cart" && count > 0 && (
                    <span className="absolute -top-1.5 -end-2 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                      {count}
                    </span>
                  )}
                </span>
                {t(key)}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/admin"
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground",
                pathname === "/admin" && "text-primary",
              )}
            >
              <Shield className={cn("size-5", pathname === "/admin" && "stroke-[2.4]")} />
              {t("admin")}
            </Link>
          )}
        </div>

      </nav>
    </div>
  );
}
