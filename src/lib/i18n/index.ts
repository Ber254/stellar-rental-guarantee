import { ERROR_CODES } from "@/lib/services/errors";

import { en, es, type Dictionary } from "./dictionaries";

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";
export const LOCALE_COOKIE = "rg_locale";

export const THEMES = ["modern", "retro"] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = "modern";
export const THEME_COOKIE = "rg_theme";

const DICTIONARIES: Record<Locale, Dictionary> = { es, en };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

export function parseLocale(value: string | undefined): Locale {
  return LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE;
}

export function parseTheme(value: string | undefined): Theme {
  return THEMES.find((theme) => theme === value) ?? DEFAULT_THEME;
}

export function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export type { Dictionary };

export function apiErrorMessage(
  t: Dictionary,
  body: { code?: unknown; error?: unknown },
  fallback: string,
): string {
  const code = ERROR_CODES.find((candidate) => candidate === body.code);
  if (code) return t.errors[code];
  return typeof body.error === "string" ? body.error : fallback;
}
