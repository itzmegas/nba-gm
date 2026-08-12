"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { createT } from "@/application/i18n/createT";
import type { Locale } from "@/application/i18n/types";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: ReturnType<typeof createT>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale: initialLocale,
  onLocaleChange,
  children,
}: {
  locale: Locale;
  onLocaleChange?: (locale: Locale) => void;
  children: ReactNode;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const contextValue: I18nContextValue = {
    locale,
    setLocale: (nextLocale) => {
      setLocale(nextLocale);
      onLocaleChange?.(nextLocale);
    },
    t: createT(locale),
  };

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useLocale(): Locale {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useLocale must be used inside I18nProvider");
  return context.locale;
}

export function useT(): I18nContextValue["t"] {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useT must be used inside I18nProvider");
  return context.t;
}

export function useSetLocale(): I18nContextValue["setLocale"] {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useSetLocale must be used inside I18nProvider");
  return context.setLocale;
}
