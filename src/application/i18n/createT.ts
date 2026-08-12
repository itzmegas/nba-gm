import { getMessages } from "./catalogs";
import type { Locale, MessageNamespace, Messages } from "./types";
export function createT(locale: Locale) {
  const messages = getMessages(locale);
  return function translate<Namespace extends MessageNamespace>(
    namespace: Namespace,
    key: keyof Messages[Namespace]
  ): string {
    const message = messages[namespace][key];
    return typeof message === "string" ? message : String(key);
  };
}
