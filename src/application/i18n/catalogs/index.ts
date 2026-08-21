import { LOCALE, type Locale } from "../types";
import { en } from "./en";
import { es } from "./es";
export { en, es };
export function getMessages(locale: Locale) {
  return locale === LOCALE.ES ? es : en;
}
