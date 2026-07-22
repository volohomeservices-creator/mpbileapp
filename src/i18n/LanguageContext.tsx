import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import en from './translations/en';
import te from './translations/te';
import hi from './translations/hi';

export type LanguageCode = 'en' | 'te' | 'hi';
type Translations = typeof en;

export const SUPPORTED_LANGUAGES = [
  { code: 'en' as const, label: 'English', nativeLabel: 'English' },
  { code: 'te' as const, label: 'Telugu', nativeLabel: 'తెలుగు' },
  { code: 'hi' as const, label: 'Hindi', nativeLabel: 'हिंदी' },
] as const;

const translations: Record<LanguageCode, Translations> = { en, te: te as any, hi: hi as any };

const LANG_KEY = 'volo_lang';

const VALID_LANGS: LanguageCode[] = ['en', 'te', 'hi'];

// Synchronously read saved language from localStorage (web only)
function getInitialLanguage(): LanguageCode {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(LANG_KEY) as LanguageCode | null;
        if (saved && VALID_LANGS.includes(saved)) return saved;
      }
    } catch {}
  }
  return 'en';
}

// Resolve dotted key path: 'customerHome.heroTitle' -> string
function resolve(obj: any, path: string): string {
  const result = path.split('.').reduce((acc, part) => acc?.[part], obj);
  return typeof result === 'string' ? result : path; // fallback: show key
}

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => Promise<void>;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: async () => {},
  t: (key) => resolve(en, key),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // On web: synchronous init from localStorage → no extra re-render after mount
  // On native: init 'en', then async restore from SecureStore
  const [language, setLang] = useState<LanguageCode>(getInitialLanguage);

  // On native — restore saved language from SecureStore after mount
  useEffect(() => {
    if (Platform.OS === 'web') return; // already handled synchronously
    SecureStore.getItemAsync(LANG_KEY)
      .then((saved) => {
        if (saved && VALID_LANGS.includes(saved as LanguageCode)) {
          setLang(saved as LanguageCode);
        }
      })
      .catch(() => {});
  }, []);

  const setLanguage = useCallback(async (code: LanguageCode) => {
    setLang(code);
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(LANG_KEY, code);
      } else {
        await SecureStore.setItemAsync(LANG_KEY, code);
      }
    } catch {}
  }, []);

  const t = useCallback(
    (key: string): string => resolve(translations[language], key),
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
