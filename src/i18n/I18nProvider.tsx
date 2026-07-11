"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_UI_LOCALE,
  isUiLocale,
  translate,
  UI_LOCALE_STORAGE_KEY,
  type MessageKey,
  type MessageValues,
  type UiLocale,
} from "@/i18n/messages";

interface I18nValue {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  t: (key: MessageKey, values?: MessageValues) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>(DEFAULT_UI_LOCALE);

  useEffect(() => {
    const saved = window.localStorage.getItem(UI_LOCALE_STORAGE_KEY);
    if (isUiLocale(saved)) {
      setLocaleState(saved);
      return;
    }
    setLocaleState(navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en");
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  const setLocale = useCallback((next: UiLocale) => {
    setLocaleState(next);
    window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, next);
  }, []);

  const t = useCallback((key: MessageKey, values?: MessageValues) => translate(locale, key, values), [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

