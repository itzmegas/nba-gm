import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { LoginForm } from "@/components/login-form";
import { resolveLocaleValue } from "@/infrastructure/i18n/request";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/infrastructure/supabase/client", () => ({
  createClient: () => ({ auth: { signUp: vi.fn(), signInWithPassword: vi.fn() } }),
}));

function renderLogin(locale: "en" | "es") {
  return renderToStaticMarkup(
    <I18nProvider locale={locale}>
      <LoginForm />
    </I18nProvider>
  );
}

describe("login internationalization", () => {
  it("renders the login surface in English", () => {
    const markup = renderLogin("en");

    expect(markup).toContain("Sign in");
    expect(markup).toContain("Sign in to your Basketball GM account");
    expect(markup).toContain("Don&#x27;t have an account?");
    expect(markup).toContain("Password");
    expect(markup).not.toContain("Iniciar sesión");
  });

  it("renders the login surface in Spanish", () => {
    const markup = renderLogin("es");

    expect(markup).toContain("Iniciar sesión");
    expect(markup).toContain("Entrá a tu cuenta de Basketball GM");
    expect(markup).toContain("¿No tenés cuenta?");
    expect(markup).toContain("Contraseña");
    expect(markup).not.toContain("Sign in to your Basketball GM account");
  });

  it("falls back to English for an unsupported locale", () => {
    expect(resolveLocaleValue("fr")).toBe("en");

    const markup = renderLogin(resolveLocaleValue("fr"));

    expect(markup).toContain("Sign in to your Basketball GM account");
    expect(markup).not.toContain("Entrá a tu cuenta de Basketball GM");
  });
});
