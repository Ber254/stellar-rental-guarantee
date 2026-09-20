"use client";

import { useRouter } from "next/navigation";

import { useI18n } from "./i18n-provider";
import {
  LOCALE_COOKIE,
  LOCALES,
  THEME_COOKIE,
  type Locale,
  type Theme,
} from "@/lib/i18n";

const YEAR = 60 * 60 * 24 * 365;

function persist(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=${YEAR};samesite=lax`;
}

function Toggle({
  options,
  active,
  onSelect,
  label,
}: {
  options: { value: string; label: string }[];
  active: string;
  onSelect: (value: string) => void;
  label: string;
}) {
  return (
    <div
      aria-label={label}
      className="inline-flex overflow-hidden rounded-card border border-line"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === active}
          onClick={() => onSelect(option.value)}
          className={`px-2 py-1 text-xs font-medium transition ${
            option.value === active
              ? "bg-accent text-accent-fg"
              : "bg-surface text-muted hover:text-fg"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Preferences({ theme }: { theme: Theme }) {
  const router = useRouter();
  const { locale, t } = useI18n();

  function selectLocale(value: string) {
    persist(LOCALE_COOKIE, value);
    router.refresh();
  }

  function selectTheme(value: string) {
    persist(THEME_COOKIE, value);
    document.documentElement.dataset.theme = value;
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Toggle
        label={t.nav.theme}
        active={theme}
        onSelect={selectTheme}
        options={[
          { value: "modern", label: t.nav.themeModern },
          { value: "retro", label: t.nav.themeRetro },
        ]}
      />
      <Toggle
        label={t.nav.language}
        active={locale}
        onSelect={selectLocale}
        options={LOCALES.map((value: Locale) => ({
          value,
          label: value.toUpperCase(),
        }))}
      />
    </div>
  );
}
