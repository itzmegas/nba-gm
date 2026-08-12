import { cookies } from "next/headers";
import { isLocale, LOCALE, type Locale } from "@/application/i18n/types";
import { getLocaleCookie } from "./cookies";

export function resolveLocaleValue(cookieLocale: unknown): Locale {
  return isLocale(cookieLocale) ? cookieLocale : LOCALE.EN;
}
export async function resolveLocale(): Promise<Locale> {
  return resolveLocaleValue(getLocaleCookie(await cookies()));
}
