import { cookies } from "next/headers";

import {
  LOCALE_COOKIE,
  THEME_COOKIE,
  parseLocale,
  parseTheme,
  type Locale,
  type Theme,
} from "./index";

export async function getLocale(): Promise<Locale> {
  return parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}

export async function getTheme(): Promise<Theme> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}
