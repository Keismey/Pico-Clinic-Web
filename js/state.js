// État partagé : données JSON chargées et réparation en cours.
import { D, faultSpot, spots, setLook, setTrace, setCut, setLayout, lp, assignBays, assignFillers, healthySpots, EXTERIOR, LOOK } from './drone.js';
import { clipSet } from './gestures/clips.js';
import { save } from './save.js';
import { TRAY } from './drone.js';
import { SPARE } from './gestures/capacitor.js';
import { ACCESS } from './ui.js';

export const game = { data: {}, repair: null, lastOrder: 'o01' };

export async function loadData() {
  const [gestures, patients, orders, tools, clients, ranks, rare, story, deco] = await Promise.all(
    ['gestures', 'patients', 'orders', 'tools', 'clients', 'ranks', 'rare_parts', 'story', 'decorations'].map((n) => fetch(`data/${n}.json`).then((r) => r.json()))
  );
  delete patients._doc;
  game.data.gestures = gestures;
  game.data.patients = patients;
  game.data.orders = orders.list;
  game.data.tests = orders.tests || [];
  game.data.tools = tools;
  game.data.clients = clients;
  game.data.ranks = ranks.list;
  game.data.rareParts = rare.list;
  game.data.story = story;
  game.data.decorations = deco.list;
}

export function getOrder(id) {
  if (id === 'free' && game.free) return game.free;
  return game.data.orders.find((o) => o.id === id) || game.data.tests.find((o) => o.id === id) || game.data.orders[0];
}

// Nombre de patients d'une commande (V3b : 2 ou 3 patients à la suite).
export function patientCount(o) {
  return o && o.patients ? o.patients.length : 1;
}

// Disposition de la carte : fixe pour une commande (rejouer = même carte), variée d'une commande à l'autre.
// Les 6 premières commandes (tutoriel) gardent la disposition de base.
function layoutOf(o, part) {
  if (o.layout !== undefined) return o.layout;
  if (!o.n || o.n <= 6) return 0;
  return (o.n * 5 + part * 3) % 4;
}

// Niveau d'un outil (1 à 4) dans la sauvegarde.
export function toolLevel(k) {
  const n = game.data.tools[k] ? game.data.tools[k].levels.length : 3;
  return Math.max(1, Math.min(n, (save.tools && save.tools[k]) || 1));
}

// Réglages des gestes pour cette réparation, modifiés par les outils achetés.
export function toolGestures() {
  const g = JSON.parse(JSON.stringify(game.data.gestures));
  const T = game.data.tools;
  const e = (k, name) => T[k].effect[name][toolLevel(k) - 1];
  // dévisseuse (niveau 3) : maintenir le doigt sur la vis suffit
  g.unscrew.hold_turns = T.driver ? e('driver', 'hold_turns') : 0;
  // visseuse turbo (niveau 4) : un toucher suffit, la vis sort toute seule
  g.unscrew.tap_turns = T.driver ? e('driver', 'tap_turns') || 0 : 0;
  // tournevis à cliquet : moins de tours à faire (vis rouillées comprises)
  const tf = T.driver ? e('driver', 'turns_factor') : 1;
  g.unscrew.turns *= tf;
  g.unscrew.turns_rusty *= tf;
  g.solder.tolerance_bonus = e('iron', 'tolerance_bonus');
  g.solder.burn_time *= e('iron', 'burn_factor');
  g.vacuum.radius = Math.round(g.vacuum.radius * e('vacuum', 'radius_factor'));
  // aspirateur cyclone : même taille, mais chaque passage enlève plus de rouille
  g.vacuum.rate *= e('vacuum', 'rate_factor') || 1;
  g.magnifier.hold *= e('lens', 'hold_factor');
  g.magnifier.scan = e('lens', 'scan');
  g.chip.snap_radius = Math.round(g.chip.snap_radius * e('tweezers', 'snap_factor'));
  g.capacitor.snap_radius = Math.round(g.capacitor.snap_radius * e('tweezers', 'snap_factor'));
  // V3a : la pince aide aussi pour les piles (même aimantation que les puces) et les broches
  g.batteries.snap_radius = g.chip.snap_radius;
  g.pins.tolerance *= e('tweezers', 'snap_factor');
  if (save.settings.tremor) easeForTremor(g);
  // gaucher : le fer se tient de l'autre côté de la pointe
  if (save.settings.lefty) g.solder.grip = [-g.solder.grip[0], g.solder.grip[1]];
  return g;
}

// V4b — Option « tremblement réduit » : tolérances élargies pour tous les gestes.
function easeForTremor(g) {
  g.solder.tolerance_bonus = (g.solder.tolerance_bonus || 0) + 12;
  g.solder.off_path_time *= 2;
  g.solder.burn_time *= 1.5;
  g.solder.speed_max *= 1.25;
  g.unscrew.slip_factor *= 1.4;
  g.unscrew.grab_factor *= 1.2;
  for (const k of ['connector', 'chip', 'capacitor', 'batteries']) g[k].snap_radius = Math.round(g[k].snap_radius * 1.5);
  g.vacuum.fragile_grace *= 1.6;
  g.magnifier.catch_radius = Math.round(g.magnifier.catch_radius * 1.4);
  g.battery.max_dev *= 1.4;
  g.battery.edge_tol *= 1.3;
  g.battery.risk_rise *= 0.7;
  g.gear.tolerance *= 1.5;
  g.gear.snap_radius = Math.round(g.gear.snap_radius * 1.4);
  g.sensor.zone *= 1.5;
  g.pins.tolerance *= 1.6;
  g.spring.speed_min *= 0.7;
  g.spring.speed_max *= 1.3;
  g.spring.risk_rise *= 0.7;
  g.oxide.break_hits += 2;
  g.heart.window *= 1.5;
  g.heart.zip_tol *= 1.3;
  g.clips.early *= 1.6;
  g.clips.grab *= 1.2;
  g.seam.tolerance *= 1.4;
  g.seam.slip_time *= 2;
  g.key.green_by_rank = g.key.green_by_rank.map((w) => w * 1.4);
  g.train.snap_radius = Math.round(g.train.snap_radius * 1.4);
}

// V4b — Option « gaucher » : bac à vis à droite, boîte de pièces neuves à gauche (miroir).
export function applyHand() {
  const L = !!save.settings.lefty;
  ACCESS.lefty = L;
  D.box.x = L ? 175 : 905;
  TRAY.x = L ? 930 : 150;
  SPARE.x = L ? 325 : 755;
}

// Commande où la loupe est présentée (GDD : diagnostic à la commande 5).
export const DIAG_FROM = 5;

// Diagnostic à la loupe : à partir de la commande 5, toutes les pannes de chaque patient sont cachées
// (commandes, défi du jour, atelier libre), jusqu'au scanner qui les révèle dès l'ouverture.
// Les 4 premières commandes (un geste appris à la fois) et les essais de gestes de l'atelier d'essai
// gardent les pannes visibles ; ses copies de commandes et son atelier libre suivent la règle du jeu.
export function diagnosed(o) {
  return !!o && !o.gesture && (!!o.free || (o.n || 0) >= DIAG_FROM);
}

// Temps cible d'une commande : celui de data/orders.json (gestes seuls), plus le temps de diagnostic
// (magnifier.time_per_fault par panne cachée, tous patients de la commande compris).
export function targetTime(o) {
  if (!o || !o.target_time) return o ? o.target_time : undefined;
  if (!diagnosed(o)) return o.target_time;
  const per = game.data.gestures.magnifier.time_per_fault || 0;
  const n = (o.patients || [o]).reduce((s, q) => s + (q.faults || []).filter((f) => !EXTERIOR.includes(f)).length, 0);
  return o.target_time + per * n;
}

// Patient d'une commande : le modèle (data/patients.json) complété par la commande (data/orders.json).
// part = numéro du patient dans une commande à plusieurs patients (o.patients[part] complète la commande).
export function buildPatient(orderId, part = 0) {
  const o = getOrder(orderId);
  const parts = patientCount(o);
  part = Math.max(0, Math.min(parts - 1, part));
  // chaque patient d'une commande multiple a ses propres pannes ; le reste vient de la commande
  const q = o.patients ? { n: o.n, ...o.patients[part] } : o;
  const m = game.data.patients[q.model] || game.data.patients.mini_drone;
  return {
    id: o.id,
    order: o,
    part, parts,
    model: m,
    family: m.family,
    name: q.name || 'patient.' + m.id,
    look: { family: m.family, ...m.look, ...(q.look || {}) },
    rank: o.rank || m.rank_min,
    trace: q.trace || m.trace,
    cuts: q.cuts || 1,
    pins: q.pins,
    layout: layoutOf(q, part),
    faults: q.faults || [],
    // (les anciens champs hidden / decoys de data/orders.json ne servent plus : tout est caché, leurres automatiques)
    // (la couture est sur le tissu, à l'extérieur : elle se voit sans loupe)
    hidden_faults: diagnosed(o) ? (q.faults || []).filter((f) => !EXTERIOR.includes(f)) : [],
    // ouverture : 4 vis, ou élytres à clips (scarabée)
    open: q.open || o.open || m.open || 'screws',
    rusty_screws: q.rusty_screws || [],
    rust: q.rust || [],
    fragile: q.fragile || m.fragile || [[625, 852, 30, 48], [452, 800, 30, 48]],
    target_time: targetTime(o),
    reward: o.reward,
  };
}

const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

// Petit hasard fixe (toujours le même dessin de rouille pour un patient).
function hash(a, b) {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

// Plaques de rouille [x, y, rayon] → cellules dont l'opacité baisse quand on aspire.
function buildRust(patches, cell, fragile = []) {
  const near = (x, y) => (fragile || []).some(([fx, fy, w, h]) => Math.abs(x - fx) < w / 2 + 14 && Math.abs(y - fy) < h / 2 + 14);
  const cells = [];
  for (const [cx, cy, r] of patches || []) {
    for (let y = cy - r; y <= cy + r; y += cell) {
      for (let x = cx - r; x <= cx + r; x += cell) {
        const d = Math.hypot(x - cx, y - cy);
        const edge = r * (0.72 + 0.28 * hash(Math.round(x), Math.round(y)));
        if (d > edge || near(x, y)) continue;
        if (cells.some((c) => c.x === x && c.y === y)) continue;
        const a = 0.55 + 0.45 * hash(y, x) * (1 - (0.5 * d) / edge);
        cells.push({ x, y, a, a0: a, dark: hash(x + 7, y + 3) > 0.7 });
      }
    }
  }
  return { cells, total: cells.reduce((s, c) => s + c.a0, 0) };
}

// Remet la carte (disposition, piste, morceau en cours, apparence) d'une réparation déjà commencée.
export function restoreBoard(rep) {
  setLayout(rep.patient.layout);
  setTrace(rep.patient.trace, rep.patient.cuts);
  setCut(rep.weld.cut || 0);
  setLook(rep.patient.look);
  setTear(rep);
  spots.bay = rep.bay;
  spots.fragile = rep.fragile;
}

// Déchirure de la peluche sur le capot : déchirée tant que la couture est à faire, puis recousue.
export function setTear(rep) {
  LOOK.tear = rep.faults.has('seams') ? 1 : rep.patient.faults.includes('seams') ? 2 : 0;
}

// part > 0 : patient suivant d'une commande à plusieurs patients (les précédents restent dans game.multi).
export function newRepair(orderId, part = 0) {
  const p = buildPatient(orderId, part);
  if (p.part === 0) game.multi = [];
  game.lastOrder = p.id;
  setLook(p.look);
  // disposition de la carte, puis tout ce qui est placé dessus passe par le miroir
  setLayout(p.layout);
  setTrace(p.trace, p.cuts);
  p.rust = p.rust.map(([x, y, r]) => [...lp(x, y), r]);
  p.fragile = p.fragile.map(([x, y, w, h]) => [...lp(x, y), w, h]);
  applyHand();
  const g = toolGestures();
  // pièces de rechange plus chères aux rangs élevés (équilibrage V3b)
  const costs = g.scoring.capacitor_cost_by_rank;
  if (costs) g.scoring.capacitor_cost = costs[Math.min(5, p.rank) - 1];
  const u = g.unscrew;
  // scanner : les pannes cachées sont affichées dès l'ouverture
  const scanned = g.magnifier.scan && p.hidden_faults.length > 0;
  // pièces des gestes secondaires (avant les cibles de la loupe, qui s'en servent)
  spots.bay = assignBays(p.faults);
  // diagnostic : pièces saines dans les baies libres, puis toutes les pièces saines servent de leurres
  const diag = p.hidden_faults.length > 0;
  const fillers = diag ? assignFillers(p.faults, spots.bay) : [];
  const decoys = diag ? healthySpots(p.faults, fillers) : [];
  // faux contact : la fiche paraît branchée tant que la loupe ne l'a pas trouvée
  const looseHidden = diag && !scanned && p.faults.includes('connector_unplugged');
  game.repair = {
    patient: p,
    g,
    scanned,
    screws: p.open === 'clips' ? [] : CORNERS.map(([sx, sy], i) => ({
      i,
      dx: sx * D.screwOff, dy: sy * D.screwOff,
      x: D.cx + sx * D.screwOff, y: D.cy + sy * D.screwOff,
      r: u.screw_radius,
      rusty: p.rusty_screws.includes(i),
      turned: 0, angle: i * 0.7, progress: 0,
      out: false, fly: null, inTray: false, damaged: 0,
    })),
    coverOpen: false,
    coverAnim: 0,
    faults: new Set(p.faults),
    plug: looseHidden
      ? { x: D.socket.x, y: D.socket.y, connected: true, lift: false, loose: true }
      : p.faults.includes('connector_unplugged')
      ? { x: D.plugStart.x, y: D.plugStart.y, connected: false, lift: false }
      : { x: D.socket.x, y: D.socket.y, connected: true, lift: false },
    // soudure de la piste coupée (déjà faite si le patient n'a pas cette panne)
    // cut = morceau en cours, prev = étain des morceaux déjà soudés, segScores = leurs notes
    weld: {
      cells: [], progress: 0, done: !p.faults.includes('trace_cut'), active: false,
      devSum: 0, devN: 0, burns: 0, shorts: 0, score: null,
      cut: 0, prev: [], segScores: [],
    },
    // puce : l'ancienne (grillée) et la neuve
    chip: p.faults.includes('chip_burnt')
      ? { old: { x: D.slot.x, y: D.slot.y, state: 'slot', fly: null }, neu: { x: D.box.x, y: D.box.y, state: 'box', fly: null }, score: null }
      : { old: { x: 0, y: 0, state: 'gone', fly: null }, neu: { x: D.slot.x, y: D.slot.y, state: 'placed', fly: null }, score: null },
    // V1a : diagnostic à la loupe, rouille, composants fragiles
    phase: p.hidden_faults.length && !scanned ? 'diag' : 'repair',
    diag: {
      hidden: new Set(p.hidden_faults),
      revealed: new Set(scanned ? p.hidden_faults : []),
      targets: [
        ...p.hidden_faults.map((f) => ({ id: f, kind: 'fault', ...faultSpot(f), done: scanned })),
        ...decoys.map(({ x, y }, i) => ({ id: 'decoy' + i, kind: 'decoy', x, y, done: false })),
      ],
      time: 0,
    },
    // pas de rouille sur les condensateurs (ni juste autour) : on peut tout nettoyer sans les toucher
    rust: buildRust(p.rust, g.vacuum.cell, p.fragile),
    // fragile : wear = temps frotté, broken = à remplacer, removed = sorti, breaks = nombre de casses
    fragile: p.fragile.map(([x, y, w, h], i) => ({ i, x, y, w, h, wear: 0, broken: false, removed: false, breaks: 0 })),
    slips: 0,
    // V3a : gestes secondaires (bay = où est chaque pièce, care = points de soin perdus, scores = précisions)
    bay: spots.bay,
    fillers,
    care: 0,
    scores: [],
    elapsed: 0,
    attempts: 0,
  };
  if (p.open === 'clips') game.repair.clips = clipSet();
  // atelier d'essai : pas de vis à retirer, le capot est déjà ouvert
  // (sauf pour essayer les clips, et la couture qui se fait capot refermé)
  const gesture = p.order.gesture;
  if (p.order.test && gesture === 'seam') {
    Object.assign(game.repair, { coverLoose: true, coverOpen: true, coverAnim: 0, seamPhase: true });
  } else if (p.order.test && gesture !== 'clips') {
    for (const s of game.repair.screws) { s.out = true; s.inTray = true; s.slot = s.i; }
    Object.assign(game.repair, { coverLoose: true, coverOpen: true, coverAnim: 1 });
    if (game.repair.clips) for (const c of game.repair.clips) { c.state = 'off'; c.off = 1; }
  }
  setTear(game.repair);
  spots.fragile = game.repair.fragile;
  return game.repair;
}
