// Notation 3 étoiles, pourboire et enregistrement dans la sauvegarde.
import { game } from './state.js';
import { save, persist } from './save.js';
import { rustCleaned } from './gestures/vacuum.js';
import { partEarned } from './progress.js';

// Propreté (%) : rouille aspirée, moins les vis abîmées et les maladresses des gestes secondaires.
export function cleanliness(rep) {
  const slip = game.data.gestures.unscrew.slip_cleanliness;
  return Math.max(0, Math.min(100, Math.round(100 * rustCleaned(rep) - rep.slips * slip - (rep.care || 0))));
}

// Précision (%) : moyenne des soudures, des alignements (puce, piles, broches, engrenage) et des réglages (100 s'il n'y en a pas).
export function precision(rep) {
  const s = [rep.weld.score, rep.chip.score, ...(rep.scores || [])].filter((v) => v !== null && v !== undefined);
  if (!s.length) return 100;
  return Math.round((100 * s.reduce((a, b) => a + b, 0)) / s.length);
}

export function scoreRepair(rep) {
  const g = (rep.g || game.data.gestures).scoring;
  const p = rep.patient;
  // commande à plusieurs patients : on note l'ensemble (moyennes, temps et pièces additionnés)
  const all = [...(p.part > 0 ? game.multi || [] : []), rep];
  const avg = (f) => Math.round(all.reduce((s, r) => s + f(r), 0) / all.length);
  const clean = avg(cleanliness);
  const prec = avg(precision);
  const elapsed = all.reduce((s, r) => s + r.elapsed, 0);
  // un condensateur cassé (ou une résistance fêlée) ne retire pas d'étoile : la pièce de rechange se paie en crédits
  const parts = all.reduce((s, r) => s + (r.partsUsed || 0) * (r.g || game.data.gestures).scoring.capacitor_cost, 0);
  const stars = [all.every((r) => r.faults.size === 0), clean >= g.clean_min, prec >= g.precise_min];
  // pas de temps cible (dernier prototype) : toujours à l'heure
  const onTime = !p.target_time || elapsed <= p.target_time;
  return { stars, clean, prec, parts, onTime, elapsed, base: p.reward, tip: onTime ? Math.round(p.reward * g.tip_ratio) : 0 };
}

// À appeler une seule fois par réparation terminée. Une commande ne paie qu'une fois :
// la rejouer permet seulement d'améliorer ses étoiles.
export function recordRepair(rep, r) {
  const id = rep.patient.id;
  const o = save.orders[id] || { stars: [false, false, false], best_time: null, paid: false, plays: 0 };
  const firstPay = !o.paid;
  const paid = (firstPay ? r.base + r.tip : 0) - r.parts;
  const count = (a) => a.filter(Boolean).length;
  const record = o.plays > 0 && count(r.stars) > count(o.stars);
  if (count(r.stars) >= count(o.stars)) o.stars = r.stars.slice();
  const tm = Math.round(r.elapsed);
  o.best_time = o.best_time === null ? tm : Math.min(o.best_time, tm);
  o.paid = true;
  o.plays++;
  save.orders[id] = o;
  save.credits = Math.max(0, save.credits + paid);
  // commande d'examen réussie (même avec 1 étoile) : nouveau rang
  const exam = rep.patient.order && rep.patient.order.exam;
  let rankUp = 0;
  if (exam && save.rank < exam) { save.rank = exam; rankUp = exam; }
  // pièce rare : 3 étoiles sur une commande clé, ou cadeau du client
  const part = rep.patient.order ? partEarned(rep.patient.order, count(o.stars)) : null;
  if (part) save.rare_parts.push(part.id);
  persist();
  return { firstPay, paid, record, rankUp, part };
}

// Atelier libre : payé à chaque fois (gains déjà réduits de moitié), rien d'autre n'est enregistré.
export function recordFree(rep, r) {
  const paid = r.base + r.tip - r.parts;
  save.credits = Math.max(0, save.credits + paid);
  save.free = { plays: ((save.free && save.free.plays) || 0) + 1 };
  persist();
  return { firstPay: true, paid, record: false, rankUp: 0, part: null };
}
