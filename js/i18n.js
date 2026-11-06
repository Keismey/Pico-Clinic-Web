// Système de langues : tous les textes passent par t("clé").
import { TEXTES_APPLI } from './textes-appli.js';

const dicts = {};
let lang = 'fr';
const warned = new Set();

export const LANGS = ['fr', 'en'];

export async function loadLanguages() {
  const loaded = await Promise.all(
    LANGS.map((l) => fetch(`lang/${l}.json`).then((r) => r.json()))
  );
  // les textes de la version Android remplacent ceux des fichiers de langue (pas sur le web : « Aller au hub »)
  const C = window.Capacitor;
  const appli = !!(C && C.isNativePlatform && C.isNativePlatform());
  LANGS.forEach((l, i) => { dicts[l] = appli ? Object.assign(loaded[i], TEXTES_APPLI[l]) : loaded[i]; });
}

export function detectLang() {
  return (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function setLang(l) {
  lang = dicts[l] ? l : 'en';
  document.documentElement.lang = lang;
  document.title = t('game.title');
  // nom du jeu lu par les lecteurs d'écran (le canevas n'a pas de texte)
  const cv = document.getElementById('game');
  if (cv) cv.setAttribute('aria-label', t('game.title'));
}

export function getLang() {
  return lang;
}

// t("clé", { n: 3 }) remplace {n} dans le texte.
export function t(key, vars) {
  let s = dicts[lang] && dicts[lang][key];
  if (s === undefined) {
    if (!warned.has(lang + key)) {
      warned.add(lang + key);
      console.warn(`[langue] clé manquante (${lang}) : ${key}`);
    }
    s = (dicts.fr && dicts.fr[key]) || key;
  }
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return s;
}
