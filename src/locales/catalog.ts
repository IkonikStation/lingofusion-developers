import english from './en.json';
import type { LanguageCode } from '../data/i18n';

export type Catalog = Record<string, string>;
const loaders = import.meta.glob<Catalog>(['./*.json', '!./en.json'], { import: 'default' });
const catalogs: Partial<Record<LanguageCode, Catalog>> = { en: english };
const pending = new Map<LanguageCode, Promise<void>>();
export function loadLocale(language: LanguageCode): Promise<void> {
  if (catalogs[language]) return Promise.resolve();
  let promise = pending.get(language);
  if (!promise) {
    promise = loaders[`./${language}.json`]().then((catalog) => { catalogs[language] = catalog; });
    pending.set(language, promise);
  }
  return promise;
}
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const templates = Object.keys(english)
  .filter((text) => text.includes('__VAR_') && text.replace(/__VAR_\d+__/g, '').trim().length >= 4)
  .sort((a, b) => b.replace(/__VAR_\d+__/g, '').length - a.replace(/__VAR_\d+__/g, '').length)
  .map((source) => ({ source, regex: new RegExp(`^${source.split(/__VAR_\d+__/).map(escape).join('(.+?)')}$`) }));

export function translateText(text: string, language: LanguageCode): string {
  if (language === 'en' || !text.trim()) return text;
  const catalog = catalogs[language];
  if (!catalog) return text;
  const normalized = normalize(text);
  let translated = catalog[normalized];
  if (!translated && normalized.length < 1600) {
    for (const template of templates) {
      const match = template.regex.exec(normalized);
      if (match && catalog[template.source]) {
        translated = catalog[template.source].replace(/__VAR_(\d+)__/g, (_, index: string) => match[Number(index) + 1]);
        break;
      }
    }
  }
  if (!translated) return text;
  return `${text.match(/^\s*/)?.[0] ?? ''}${translated}${text.match(/\s*$/)?.[0] ?? ''}`;
}
