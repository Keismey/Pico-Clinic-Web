// Geste de soudure : poser le fer sur la pastille A, attendre qu'il chauffe,
// puis suivre le chemin d'un trait continu jusqu'à la pastille B.
// Progression = projection de la pointe sur la courbe (vers l'avant seulement).
// Le doigt tient le manche (params.grip) : la pointe reste devant le doigt, bien visible.
// Trop lent = brûlure ; trop rapide = soudure froide ; hors du chemin trop longtemps = court-circuit.
import { SOLDER } from '../drone.js';

const SCORE = { good: 1, cold: 0.5, burnt: 0.3 };

// Point de la courbe le plus proche de (x, y), cherché entre les longueurs s0 et s1.
function nearest(x, y, s0, s1) {
  const P = SOLDER.pts;
  let best = { s: s0, d: Infinity };
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i];
    if (b.s < s0 || a.s > s1) continue;
    const vx = b.x - a.x, vy = b.y - a.y;
    const L2 = vx * vx + vy * vy || 1;
    const k = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / L2));
    const px = a.x + vx * k, py = a.y + vy * k;
    const d = Math.hypot(x - px, y - py);
    if (d < best.d) best = { s: a.s + (b.s - a.s) * k, d };
  }
  return best;
}

export function createSolder(weld, params, tolerance, hooks = {}) {
  const n = Math.ceil(SOLDER.len / params.cell);
  const step = SOLDER.len / n;
  const finger = { x: 0, y: 0 };
  let act = null;          // trait en cours
  let heatShown = 0;       // chaleur affichée (refroidit quand on lâche)
  const tip = { x: SOLDER.a.x, y: SOLDER.a.y };
  // endroit du manche où poser le doigt pour prendre le fer
  const grip = { x: SOLDER.a.x + params.grip[0], y: SOLDER.a.y + params.grip[1] };

  function reset() {
    weld.cells = new Array(n).fill(null);
    weld.progress = 0;
    weld.devSum = 0;
    weld.devN = 0;
  }
  if (!weld.done) reset();

  function end() {
    act = null;
    weld.active = false;
  }

  function finish() {
    for (let i = 0; i < n; i++) if (!weld.cells[i]) weld.cells[i] = 'good';
    const mean = weld.cells.reduce((sum, c) => sum + SCORE[c], 0) / n;
    const dev = weld.devN ? weld.devSum / weld.devN : 0;
    const devK = Math.max(0, 1 - 0.35 * Math.pow(dev / tolerance, 2));
    weld.score = Math.max(0, Math.min(1, mean * devK));
    weld.done = true;
    end();
    if (hooks.onDone) hooks.onDone(weld.score);
  }

  return {
    tip,
    grip,
    get active() { return !!act; },
    get heat() { return act ? act.heat : heatShown; },
    get hot() { return !!act && act.heat >= 1; },
    get speed() { return act ? act.speed : 0; },
    // 'slow' | 'good' | 'fast' pendant le tracé
    get pace() {
      if (!act || act.heat < 1) return null;
      if (act.speed > params.speed_max) return 'fast';
      if (act.speed < params.speed_min) return 'slow';
      return 'good';
    },

    down(x, y) {
      if (weld.done) return false;
      if (Math.hypot(x - grip.x, y - grip.y) > params.grab_radius) return false;
      reset();
      finger.x = x; finger.y = y;
      act = { offX: SOLDER.a.x - x, offY: SOLDER.a.y - y, heat: 0, offT: 0, dwell: 0, speed: 0 };
      tip.x = SOLDER.a.x; tip.y = SOLDER.a.y;
      weld.active = true;
      if (hooks.onGrab) hooks.onGrab();
      return true;
    },

    move(x, y) {
      finger.x = x; finger.y = y;
    },

    update(dt) {
      if (!act) {
        heatShown = Math.max(0, heatShown - dt / 0.6);
        return;
      }
      tip.x = finger.x + act.offX;
      tip.y = finger.y + act.offY;

      // chauffe sur la pastille
      if (act.heat < 1) {
        act.heat = Math.min(1, act.heat + dt / params.heat_time);
        heatShown = act.heat;
        if (Math.hypot(tip.x - SOLDER.a.x, tip.y - SOLDER.a.y) > tolerance * 1.5) {
          end();
          if (hooks.onTooEarly) hooks.onTooEarly();
          return;
        }
        if (act.heat >= 1 && hooks.onHot) hooks.onHot();
        return;
      }
      heatShown = 1;

      // suivi du chemin
      const near = nearest(tip.x, tip.y, Math.max(0, weld.progress - 30), weld.progress + 90);
      if (near.d > tolerance) {
        act.offT += dt;
        if (act.offT > params.off_path_time) {
          weld.shorts++;
          const at = { x: tip.x, y: tip.y };
          reset();
          end();
          if (hooks.onShort) hooks.onShort(at);
          return;
        }
      } else {
        act.offT = 0;
      }

      const newS = near.d <= tolerance ? Math.max(weld.progress, near.s) : weld.progress;
      const inst = (newS - weld.progress) / Math.max(dt, 1e-3);
      act.speed += (inst - act.speed) * Math.min(1, dt * 7);

      // cellules recouvertes d'étain
      const i0 = Math.floor(weld.progress / step);
      const i1 = Math.min(n - 1, Math.floor(newS / step));
      const kind = act.speed > params.speed_max ? 'cold' : 'good';
      for (let i = i0; i <= i1; i++) {
        if (weld.cells[i] !== 'burnt') weld.cells[i] = weld.cells[i] === 'cold' ? 'cold' : kind;
      }
      if (newS > weld.progress) {
        weld.devSum += near.d * (i1 - i0 + 1);
        weld.devN += i1 - i0 + 1;
      }
      weld.progress = newS;

      // trop lent : le fer reste au même endroit et brûle
      if (act.speed < params.speed_min) {
        act.dwell += dt;
        if (act.dwell >= params.burn_time) {
          act.dwell = 0;
          weld.burns++;
          const i = Math.min(n - 1, Math.floor(weld.progress / step));
          weld.cells[i] = 'burnt';
          if (i > 0) weld.cells[i - 1] = 'burnt';
          if (hooks.onBurn) hooks.onBurn({ x: tip.x, y: tip.y });
        }
      } else {
        act.dwell = Math.max(0, act.dwell - dt * 2);
      }

      if (weld.progress >= SOLDER.len - step * 1.5 && Math.hypot(tip.x - SOLDER.b.x, tip.y - SOLDER.b.y) <= tolerance) {
        finish();
      }
    },

    up() {
      if (!act) return;
      const started = act.heat >= 1 && weld.progress > 0;
      reset();
      end();
      if (started && hooks.onBreak) hooks.onBreak();
    },
  };
}
