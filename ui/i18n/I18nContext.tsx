import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import translations, { type Locale, type Translations } from "./translations";

interface I18nContextValue {
  locale: Locale;
  t: Translations;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

const STORAGE_KEY = "designready-locale";

function getInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "vi" || stored === "en") return stored;
  } catch { /* ignore */ }
  return "en";
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  t: translations.en,
  setLocale: () => {},
  toggleLocale: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try { localStorage.setItem(STORAGE_KEY, newLocale); } catch { /* ignore */ }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "en" ? "vi" : "en");
  }, [locale, setLocale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    t: translations[locale],
    setLocale,
    toggleLocale,
  }), [locale, setLocale, toggleLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
