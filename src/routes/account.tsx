import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, LogOut, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SupportBox } from "@/components/SupportBox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { emailForPhone, isValidPhone, normalizePhone, useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "حسابي | SmartTech" },
      { name: "description", content: "سجّل الدخول برقم الهاتف وكلمة المرور لمتابعة طلباتك." },
      { property: "og:title", content: "حسابي | SmartTech" },
      { property: "og:description", content: "إدارة بياناتك ومتابعة طلباتك في SmartTech." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { t } = useLang();
  const { user, profile, isAdmin, loading, refreshProfile } = useAuth();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.full_name);
      setPhone(profile.phone);
    }
  }, [profile]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhone(phone)) {
      toast.error(t("invalidPhone"));
      return;
    }
    if (password.length < 6) {
      toast.error(t("passwordShort"));
      return;
    }
    if (mode === "register" && name.trim().length < 3) {
      toast.error(t("nameRequired"));
      return;
    }
    setBusy(true);
    const email = emailForPhone(phone);
    const digits = normalizePhone(phone);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(t("wrongCredentials"));
      } else {
        const signUp = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name.trim(), phone: digits } },
        });
        if (signUp.error) {
          throw new Error(
            signUp.error.message.toLowerCase().includes("already")
              ? t("accountExists")
              : signUp.error.message,
          );
        }
        if (!signUp.data.session) {
          const retry = await supabase.auth.signInWithPassword({ email, password });
          if (retry.error) throw new Error(retry.error.message);
        }
        const { data: session } = await supabase.auth.getUser();
        if (session.user) {
          await supabase
            .from("profiles")
            .upsert({ id: session.user.id, full_name: name.trim(), phone: digits });
        }
      }
      await refreshProfile();
      toast.success(t("welcome"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (!user) return;
    if (name.trim().length < 3) {
      toast.error(t("nameRequired"));
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim() })
      .eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      await refreshProfile();
      toast.success(t("saved"));
    }
  };

  if (loading) return <div className="h-56 animate-pulse rounded-2xl bg-muted" />;

  if (!user) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-bold">{t(mode === "signin" ? "signIn" : "register")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("authHint")}</p>
        <p className="mt-3 rounded-xl border border-primary/25 bg-primary-soft p-3 text-sm font-medium text-accent-foreground">
          🎁 {t("firstOrderNote")}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
          {(["signin", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full py-2 text-sm font-semibold transition ${
                mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t(m === "signin" ? "signIn" : "register")}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-4 rounded-2xl border bg-card p-4">
          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="name">{t("fullName")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              placeholder="07xx xxx xxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
            />
            <p className="rounded-xl bg-sand p-2.5 text-xs leading-relaxed text-muted-foreground">
              {t("whatsappNote")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              dir="ltr"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={72}
            />
          </div>
          <Button type="submit" className="h-12 w-full rounded-full text-base" disabled={busy}>
            {t(mode === "signin" ? "signIn" : "register")}
          </Button>
        </form>
      </div>
    );
  }


  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">
        {t("welcome")}، {profile?.full_name}
      </h1>
      {isAdmin && (
        <Link
          to="/admin"
          className="flex items-center justify-between rounded-2xl border bg-primary-soft px-4 py-3 text-sm font-semibold text-accent-foreground"
        >
          <span className="flex items-center gap-2">
            <Shield className="size-4" />
            {t("admin")}
          </span>
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </Link>
      )}

      <div className="space-y-4 rounded-2xl border bg-card p-4">
        <h2 className="text-base font-semibold">{t("editProfile")}</h2>
        <div className="space-y-2">
          <Label htmlFor="pname">{t("fullName")}</Label>
          <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pphone">{t("phone")}</Label>
          <Input id="pphone" value={profile?.phone ?? ""} dir="ltr" disabled />
        </div>
        <Button className="w-full rounded-full" disabled={busy} onClick={() => void onSave()}>
          {t("save")}
        </Button>
      </div>

      <SupportBox />

      <Button
        variant="outline"
        className="w-full rounded-full"
        onClick={() => void supabase.auth.signOut()}
      >
        <LogOut className="size-4" />
        {t("signOut")}
      </Button>
    </div>
  );
}
