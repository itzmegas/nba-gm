"use client";

import { LOCALE, type Locale } from "@/application/i18n/types";
import { useLocale, useSetLocale, useT } from "@/application/providers/I18nProvider";

export function LocaleSwitcher() {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const t = useT();

  return (
    <label>
      <span className="sr-only">{t("common", "language")}</span>
      <select
        aria-label={t("common", "language")}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        <option value={LOCALE.EN}>{t("common", "english")}</option>
        <option value={LOCALE.ES}>{t("common", "spanish")}</option>
      </select>
    </label>
  );
}
