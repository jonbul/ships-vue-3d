import { computed, ref, watch } from 'vue'

import en from './en'
import es from './es'
import eu from './eu'

export type { Messages } from './en'

/**
 * The site's languages, each named in itself for the language picker. English
 * is the fallback for browsers asking for anything else.
 */
export const LOCALES = {
  en: 'English',
  es: 'Español',
  eu: 'Euskara',
} as const

export type Locale = keyof typeof LOCALES

const catalogs = { en, es, eu }
const LOCALE_KEY = 'ships3d.locale'

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && value in LOCALES
}

/** The saved choice, else the first of the browser's languages we have. */
function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_KEY)
    if (isLocale(saved)) return saved
  } catch {
    // Private windows may refuse storage.
  }
  const preferred = typeof navigator === 'undefined' ? [] : navigator.languages
  for (const tag of preferred ?? []) {
    const language = tag.split('-')[0]!.toLowerCase()
    if (isLocale(language)) return language
  }
  return 'en'
}

export const locale = ref<Locale>(initialLocale())

/**
 * The messages in the current language. Templates read `t.section.key`;
 * scripts read `t.value`. Text built outside Vue (the game's HUD) is read
 * once, when it is built: the language can't change during a game.
 */
export const t = computed(() => catalogs[locale.value])

export function setLocale(value: Locale): void {
  locale.value = value
  try {
    localStorage.setItem(LOCALE_KEY, value)
  } catch {
    // Not important enough to report.
  }
}

if (typeof document !== 'undefined') {
  watch(locale, (value) => (document.documentElement.lang = value), { immediate: true })
}
