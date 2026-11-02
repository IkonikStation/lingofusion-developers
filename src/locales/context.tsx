import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getDeviceLanguage } from '../data/i18n';
import type { LanguageCode } from '../data/i18n';
import { loadLocale } from './catalog';

export const LocaleContext = createContext<LanguageCode>('en');
export const UntranslatedContext = createContext(false);
export const useLocale = () => useContext(LocaleContext);
export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<LanguageCode>('en');
  useEffect(() => {
    let revision = 0;
    const update = () => {
      const current = ++revision;
      const preferred = getDeviceLanguage();
      void loadLocale(preferred).then(() => {
        if (current === revision) setLanguage(preferred);
      }).catch(() => {
        if (current === revision) setLanguage('en');
      });
    };
    update();
    window.addEventListener('languagechange', update);
    return () => { revision++; window.removeEventListener('languagechange', update); };
  }, []);
  return <LocaleContext.Provider value={language}>{children}</LocaleContext.Provider>;
}
