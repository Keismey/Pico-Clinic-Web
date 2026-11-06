// Version du jeu, notes de mise à jour et changement de langue (mémorisé dans la sauvegarde).
import { setLang } from './i18n.js';
import { save, persist } from './save.js';

export const VERSION = '1.0.0';

// Notes de mise à jour, la plus récente en premier (affichées dans les Options, et une fois après chaque mise à jour).
export const NOTES = [
  { v: '1.0.0', d: ['3 novembre 2026', '3 November 2026'],
    fr: ['Pico-Clinic arrive sur Google Play : 60 commandes en 5 chapitres, la boutique et les décorations, le défi du jour et l’Atelier libre.'],
    en: ['Pico-Clinic comes to Google Play: 60 orders across 5 chapters, the shop and decorations, the daily challenge and the Free Workshop.'] },
];

const NOTES_KEY = 'pico_notes';

// Une fois après chaque mise à jour, et seulement pour un joueur qui a déjà joué (un nouveau joueur ne les voit pas).
export function notesDue() {
  let seen = null;
  try { seen = localStorage.getItem(NOTES_KEY); } catch (e) { return false; }
  if (seen === VERSION) return false;
  const played = save.credits > 0 || Object.keys(save.orders).length > 0;
  if (!played) { notesSeen(); return false; }
  return true;
}

export function notesSeen() {
  try { localStorage.setItem(NOTES_KEY, VERSION); } catch (e) { /* stockage indisponible */ }
}

export function changeLang(l) {
  setLang(l);
  save.settings.lang = l;
  persist();
}
