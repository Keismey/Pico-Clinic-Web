// Progression : commandes débloquées une à une, examen de rang, achats d'outils.
import { game, toolLevel } from './state.js';
import { save, persist, totalStars } from './save.js';

export const TOOL_KEYS = ['driver', 'iron', 'vacuum', 'lens', 'tweezers'];

function paid(o) {
  return !!(o && save.orders[o.id] && save.orders[o.id].paid);
}

// Rangs : étoiles nécessaires et commande d'examen (data/ranks.json).
export function rankInfo(r) {
  return game.data.ranks.find((x) => x.rank === r) || null;
}

// Étoiles nécessaires pour ouvrir une commande d'examen (0 si ce n'en est pas une).
export function examStars(o) {
  const r = o && o.exam ? rankInfo(o.exam) : null;
  return r ? r.stars : 0;
}

export function orderByNumber(n) {
  return game.data.orders.find((o) => o.n === n) || null;
}

// Clients : commandes existantes, commandes terminées, rencontré ou non.
export function clientOrders(id) {
  return game.data.orders.filter((o) => o.client === id);
}

export function clientDone(id) {
  return clientOrders(id).filter(paid).length;
}

export function clientMet(id) {
  return !!(save.clients[id] && save.clients[id].met) || clientDone(id) > 0;
}

export function meetClient(id) {
  if (clientMet(id) && save.clients[id]) return;
  save.clients[id] = { ...(save.clients[id] || {}), met: true };
  persist();
}

// Dernière commande terminée d'un client (pour son « dernier mot » dans le Carnet).
export function lastOrderOf(id) {
  const done = clientOrders(id).filter(paid);
  return done.length ? done[done.length - 1] : null;
}

// Pièces rares.
export function hasPart(id) {
  return save.rare_parts.includes(id);
}

// Pièce rare gagnée par cette commande avec ces étoiles (ou null).
export function partEarned(o, stars) {
  const p = game.data.rareParts.find((x) => x.order === o.n);
  if (!p || hasPart(p.id)) return null;
  if (p.how === 'stars3' && stars < 3) return null;
  return p;
}

// V3b : pièces rares exigées par un prototype (rare_parts.json → use = numéro de la commande).
export function partsNeeded(o) {
  return game.data.rareParts.filter((p) => p.use === o.n);
}
export function missingParts(o) {
  return partsNeeded(o).filter((p) => !hasPart(p.id));
}

// 'done' (déjà réussie), 'open' (jouable), 'locked' (finir la précédente), 'stars' (examen : pas assez d'étoiles),
// 'part' (prototype : il manque une pièce rare). Un prototype qui attend sa pièce ne bloque pas les suivantes.
export function orderState(o) {
  if (paid(o)) return 'done';
  const list = game.data.orders;
  for (let i = list.indexOf(o) - 1; i >= 0; i--) {
    const prev = list[i];
    if (paid(prev)) break;
    if (missingParts(prev).length && orderState(prev) === 'part') continue;
    return 'locked';
  }
  if (examStars(o) && totalStars() < examStars(o)) return 'stars';
  if (missingParts(o).length) return 'part';
  return 'open';
}

export function orderStars(o) {
  const r = save.orders[o.id];
  return r ? r.stars.filter(Boolean).length : 0;
}

// Commande suivante (on saute les prototypes qui attendent encore une pièce rare).
export function nextOrder(o) {
  const list = game.data.orders;
  for (let i = list.indexOf(o) + 1; i < list.length; i++) if (orderState(list[i]) !== 'part') return list[i];
  return null;
}

// Prochain niveau d'un outil : { id, price, rank } ou null s'il est au maximum.
export function nextTool(k) {
  return game.data.tools[k].levels[toolLevel(k)] || null;
}

export function currentTool(k) {
  return game.data.tools[k].levels[toolLevel(k) - 1];
}

// 'max', 'rank' (rang trop bas), 'money' (pas assez de crédits) ou 'ok'.
export function buyState(k) {
  const n = nextTool(k);
  if (!n) return 'max';
  if (save.rank < n.rank) return 'rank';
  if (save.credits < n.price) return 'money';
  return 'ok';
}

export function buyTool(k) {
  if (buyState(k) !== 'ok') return false;
  const n = nextTool(k);
  save.credits -= n.price;
  save.tools[k] = toolLevel(k) + 1;
  persist();
  return true;
}
