import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { en, es } from "@/application/i18n/catalogs";
import { createT } from "@/application/i18n/createT";
import { LOCALE } from "@/application/i18n/types";
import {
  getLocaleCookie,
  LOCALE_COOKIE_NAME,
  setLocaleCookie,
} from "@/infrastructure/i18n/cookies";
import { I18nRuntime } from "@/infrastructure/i18n/I18nRuntime";
import { resolveLocaleValue } from "@/infrastructure/i18n/request";

describe("internationalization foundation", () => {
  it("keeps every Spanish catalog key aligned with canonical English", () => {
    for (const namespace of Object.keys(en) as Array<keyof typeof en>) {
      expect(Object.keys(es[namespace])).toEqual(Object.keys(en[namespace]));
    }
  });

  it("translates through the same API for both locales", () => {
    expect(createT(LOCALE.EN)("common", "loading")).toBe("Loading...");
    expect(createT(LOCALE.ES)("common", "loading")).toBe("Cargando...");
  });

  it("uses the requested key as a visible missing-message fallback", () => {
    expect(createT(LOCALE.ES)("common", "missing" as "error")).toBe("missing");
  });

  it("resolves only supported cookie values and defaults to English", () => {
    expect(resolveLocaleValue("es")).toBe(LOCALE.ES);
    expect(resolveLocaleValue("en")).toBe(LOCALE.EN);
    expect(resolveLocaleValue("invalid")).toBe(LOCALE.EN);
    expect(resolveLocaleValue(undefined)).toBe(LOCALE.EN);
    expect(resolveLocaleValue("fr")).toBe(LOCALE.EN);
  });

  it("wires the locale provider and persistence inside the client adapter", () => {
    const markup = renderToStaticMarkup(
      <I18nRuntime locale={LOCALE.ES}>
        <span>content</span>
      </I18nRuntime>
    );

    expect(markup).toContain("content");
  });

  it("keeps the application provider isolated from infrastructure", () => {
    const providerSource = readFileSync(
      new URL("../../src/application/providers/I18nProvider.tsx", import.meta.url),
      "utf8"
    );

    expect(providerSource).not.toContain("@/infrastructure/");
  });

  it("keeps root document language tied to the resolved provider locale", () => {
    const layoutSource = readFileSync(new URL("../../src/app/layout.tsx", import.meta.url), "utf8");

    expect(layoutSource).toContain("<html lang={locale}");
    expect(layoutSource).toContain("<I18nRuntime locale={locale}>");
    expect(layoutSource).not.toContain("onLocaleChange=");
  });

  it("keeps locale switching controlled and persistence behind the adapter", () => {
    const providerSource = readFileSync(
      new URL("../../src/application/providers/I18nProvider.tsx", import.meta.url),
      "utf8"
    );
    const runtimeSource = readFileSync(
      new URL("../../src/infrastructure/i18n/I18nRuntime.tsx", import.meta.url),
      "utf8"
    );

    expect(providerSource).toContain("onLocaleChange?.(nextLocale)");
    expect(runtimeSource).toContain("onLocaleChange={setLocaleCookie}");
  });

  it("persists an explicit locale switch through the adapter callback", () => {
    const cookieStore = { cookie: "" };
    const runtimeSource = readFileSync(
      new URL("../../src/infrastructure/i18n/I18nRuntime.tsx", import.meta.url),
      "utf8"
    );

    expect(runtimeSource).toContain("onLocaleChange={setLocaleCookie}");
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", { configurable: true, value: cookieStore });
    setLocaleCookie(LOCALE.ES);
    expect(cookieStore.cookie).toContain(`${LOCALE_COOKIE_NAME}=es`);
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
  });

  it("only accepts supported locale cookie values", () => {
    expect(getLocaleCookie({ get: () => ({ value: "es" }) })).toBe(LOCALE.ES);
    expect(getLocaleCookie({ get: () => ({ value: "fr" }) })).toBeUndefined();
    expect(LOCALE_COOKIE_NAME).toBe("gm-locale");
  });
});
