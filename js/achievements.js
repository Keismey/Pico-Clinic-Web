// Succès : 5 succès à 3 paliers (bronze, argent, or), payés en crédits (GDD : complètent les pièces rares).
// Les paliers gagnés sont rangés dans save.ach ({ id: nombre de paliers payés }) ; les compteurs qui ne se
// retrouvent pas dans la sauvegarde (à l'heure, défis réussis, série) sont dans save.stats.
import { save, persist, totalStars } from './save.js';
import { dateKey } from './daily.js';

export const REWARD = [50, 150, 300];

const repaired = () => Object.values(save.orders).filter((o) => o.stars && o.stars[0]).length;

export const ACHIEVEMENTS = [
  { id: 'repairs', tiers: [10, 30, 60], value: repaired },
  { id: 'stars', tiers: [60, 120, 180], value: () => totalStars() },
  { id: 'on_time', tiers: [10, 30, 60], value: () => save.stats.on_time },
  { id: 'daily', tiers: [5, 15, 30], value: () => save.stats.daily_wins },
  { id: 'streak', tiers: [3, 7, 14], value: () => save.stats.streak.best },
];

// Paliers atteints (0 à 3) d'après la progression, payés ou non.
export function reached(a) {
  const v = a.value();
  return a.tiers.filter((n) => v >= n).length;
}

// Paliers déjà payés.
export function earned(id) {
  return (save.ach && save.ach[id]) || 0;
}

// Paie les paliers atteints et pas encore payés. Renvoie [{ id, tier, reward }] (vide s'il n'y a rien).
export function checkAchievements() {
  if (!save.ach) save.ach = {};
  const out = [];
  for (const a of ACHIEVEMENTS) {
    const got = earned(a.id);
    const now = reached(a);
    for (let tier = got + 1; tier <= now; tier++) {
      save.credits += REWARD[tier - 1];
      out.push({ id: a.id, tier, reward: REWARD[tier - 1] });
    }
    if (now > got) save.ach[a.id] = now;
  }
  if (out.length) persist();
  return out;
}

// Fin d'une réparation (pas l'atelier d'essai) : réparée avant le temps cible ?
export function countRepair(rep, res) {
  if (res.stars[0] && rep.patient.target_time && res.onTime) save.stats.on_time++;
}

// Premier défi réussi d'une journée : un de plus, et la série de jours de suite.
export function countDailyWin(key = dateKey()) {
  const st = save.stats;
  st.daily_wins++;
  const d = new Date(key + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  st.streak.cur = st.streak.last === dateKey(d) ? st.streak.cur + 1 : 1;
  st.streak.last = key;
  st.streak.best = Math.max(st.streak.best, st.streak.cur);
}
