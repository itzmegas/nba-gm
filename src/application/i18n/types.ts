export const LOCALE = { EN: "en", ES: "es" } as const;
export type Locale = (typeof LOCALE)[keyof typeof LOCALE];
export const SUPPORTED_LOCALES = [LOCALE.EN, LOCALE.ES] as const satisfies readonly Locale[];

import type { en } from "./catalogs/en";
export type MessageNamespace = keyof typeof en;
export type Messages = {
  [Namespace in keyof typeof en]: {
    [Key in keyof (typeof en)[Namespace]]: string;
  };
};
export function isLocale(value: unknown): value is Locale {
  return value === LOCALE.EN || value === LOCALE.ES;
}
