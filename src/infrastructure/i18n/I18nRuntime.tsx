"use client";

import type { ReactNode } from "react";
import type { Locale } from "@/application/i18n/types";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { setLocaleCookie } from "@/infrastructure/i18n/cookies";

interface I18nRuntimeProps {
  locale: Locale;
  children: ReactNode;
}

export function I18nRuntime({ locale, children }: I18nRuntimeProps) {
  return (
    <I18nProvider locale={locale} onLocaleChange={setLocaleCookie}>
      {children}
    </I18nProvider>
  );
}
