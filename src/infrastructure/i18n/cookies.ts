import { isLocale, type Locale } from "@/application/i18n/types";

export const LOCALE_COOKIE_NAME = "gm-locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

interface CookieReader {
  get: (name: string) => { value: string } | undefined;
}

export function getLocaleCookie(cookieStore: CookieReader): Locale | undefined {
  const value = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  return isLocale(value) ? value : undefined;
}

export function setLocaleCookie(locale: Locale): void {
  if (typeof document === "undefined") return;

  // biome-ignore lint/suspicious/noDocumentCookie: The locale cookie is intentionally client-readable.
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; Max-Age=${LOCALE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}
