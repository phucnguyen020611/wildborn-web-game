import vi from './vi.json';
import en from './en.json';

export type Lang = 'vi' | 'en';
export const LANGS: Lang[] = ['vi', 'en'];
const dicts: Record<Lang, Record<string, string>> = { vi, en };
const STORAGE_KEY = 'wildborn.lang';

let lang: Lang = detect();

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'vi' || saved === 'en') return saved;
  } catch {
    // storage blocked (private mode, policy): fall through to browser language
  }
  return navigator.language.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

export function getLang() {
  return lang;
}

/** `t('hud.ammo', { count: 3 })` replaces `{count}`. Missing keys fall back to English, then to the key itself. */
export function t(key: string, params?: Record<string, string | number>) {
  let s = dicts[lang][key] ?? dicts.en[key];
  if (s === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function setLang(next: Lang) {
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // not persisted; still applies for this session
  }
  applyI18n();
}

/** Fills every `[data-i18n]` element and the document-level language metadata. */
export function applyI18n() {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n!);
  });
  document.documentElement.lang = lang;
  document.title = t('meta.title');
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', t('meta.description'));
}
