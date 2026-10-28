"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useT } from "@/application/providers/I18nProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/infrastructure/supabase/client";

const passwordSchema = z
  .object({ password: z.string().min(6), confirm: z.string() })
  .refine(({ password, confirm }) => password === confirm);

export function PasswordForm() {
  const t = useT();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const invalidLink = new URLSearchParams(window.location.search).has("error");
    if (invalidLink) setError(t("auth", "recoveryFailed"));
    void createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (active) setAuthenticated(Boolean(user) && !invalidLink);
      })
      .catch(() => {
        if (active) setError(t("auth", "passwordError"));
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      if (authenticated) {
        const parsed = passwordSchema.safeParse(Object.fromEntries(form));
        if (!parsed.success) {
          setError(t("auth", "passwordInvalid"));
          return;
        }
        const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
        if (error) throw error;
      } else {
        const parsed = z.email().safeParse(form.get("email"));
        if (!parsed.success) {
          setError(t("auth", "emailInvalid"));
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
          redirectTo: `${window.location.origin}/auth/recovery`,
        });
        if (error) throw error;
      }
      setDone(true);
    } catch {
      setError(t("auth", "passwordError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t("auth", "changePassword")}</CardTitle>
        <CardDescription>
          {t("auth", authenticated ? "newPasswordDescription" : "recoveryDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {checking ? (
          <output>{t("auth", "checkingSession")}</output>
        ) : done ? (
          <output>{t("auth", authenticated ? "passwordUpdated" : "recoverySent")}</output>
        ) : (
          <form onSubmit={handleSubmit} aria-label={t("auth", "changePassword")}>
            <FieldGroup>
              {authenticated ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="new-password">{t("auth", "newPassword")}</FieldLabel>
                    <Input
                      id="new-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                      disabled={busy}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="confirm-password">
                      {t("auth", "confirmPassword")}
                    </FieldLabel>
                    <Input
                      id="confirm-password"
                      name="confirm"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                      disabled={busy}
                    />
                  </Field>
                </>
              ) : (
                <Field>
                  <FieldLabel htmlFor="recovery-email">{t("auth", "email")}</FieldLabel>
                  <Input
                    id="recovery-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={busy}
                  />
                </Field>
              )}
              <Button type="submit" disabled={busy}>
                {t(
                  "auth",
                  busy ? "passwordSaving" : authenticated ? "changePassword" : "sendRecovery"
                )}
              </Button>
            </FieldGroup>
          </form>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
        <Link href={authenticated ? "/" : "/login"} className="mt-4 block text-sm underline">
          {t("auth", authenticated ? "backToGame" : "signIn")}
        </Link>
      </CardContent>
    </Card>
  );
}
