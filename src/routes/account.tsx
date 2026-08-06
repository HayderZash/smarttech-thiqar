import { createFileRoute } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { credentialsForPhone, isValidPhone, normalizePhone, useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "حسابي | متجر النور" },
      { name: "description", content: "سجّل الدخول بالاسم ورقم الهاتف لمتابعة طلباتك." },
      { property: "og:title", content: "حسابي | متجر النور" },
      { property: "og:description", content: "إدارة بياناتك ومتابعة طلباتك في متجر النور." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { t } = useLang();
  const { user, profile, isAdmin, loading, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.full_name);
      setPhone(profile.phone);
    }
  }, [profile]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3) {
      toast.error(t("nameRequired"));
      return;
    }
    if (!isValidPhone(phone)) {
      toast.error(t("invalidPhone"));
      return;
    }
    setBusy(true);
    const { email, password } = credentialsForPhone(phone);
    const digits = normalizePhone(phone);
    try {
      const signIn = await supabase.auth.signInWithPassword({ email, password });
      if (signIn.error) {
        const signUp = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name.trim(), phone: digits } },
        });
        if (signUp.error) throw signUp.error;
        if (!signUp.data.session) {
          const retry = await supabase.auth.signInWithPassword({ email, password });
          if (retry.error) throw retry.error;
        }
      }
      const { data: session } = await supabase.auth.getUser();
      if (session.user) {
        await supabase
          .from("profiles")
          .upsert({ id: session.user.id, full_name: name.trim(), phone: digits });
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
        <h1 className="text-xl font-bold">{t("signIn")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("authHint")}</p>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-4 rounded-2xl border bg-card p-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("fullName")}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
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
          </div>
          <Button type="submit" className="h-12 w-full rounded-full text-base" disabled={busy}>
            {t("signIn")}
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
        <p className="rounded-xl bg-primary-soft px-3 py-2 text-sm font-semibold text-accent-foreground">
          {t("admin")}
        </p>
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
