// Condensateur abîmé : le sortir de la carte, puis poser un neuf à sa place (comme la puce).
import { D } from '../drone.js';

// Rangement des condensateurs neufs, à gauche de la boîte de pièces.
export const SPARE = { x: 755, y: 222 };

export function createCapacitor(rep, params, hooks = {}) {
  let drag = null; // { comp, what: 'old' | 'new', x, y, offY }
  const finger = { x: 0, y: 0 };

  function onBoard(x, y) {
    return Math.abs(x - D.cx) < D.board && Math.abs(y - D.cy) < D.board;
  }

  // Le prochain condensateur qui attend une pièce neuve.
  function waiting() {
    return rep.fragile.find((c) => c.broken && c.removed);
  }

  return {
    get held() { return drag; },
    get spare() { return waiting(); },

    down(x, y) {
      for (const c of rep.fragile) {
        if (!c.broken || c.removed) continue;
        if (Math.abs(x - c.x) < c.w / 2 + params.grab_pad && Math.abs(y - c.y) < c.h / 2 + params.grab_pad) {
          drag = { comp: c, what: 'old', x: c.x, y: c.y, offY: c.y - y };
          c.held = true;
          finger.x = x; finger.y = y;
          if (hooks.onGrab) hooks.onGrab();
          return true;
        }
      }
      const w = waiting();
      if (w && Math.hypot(x - SPARE.x, y - SPARE.y) < params.grab_radius) {
        drag = { comp: w, what: 'new', x: SPARE.x, y: SPARE.y, offY: SPARE.y - y };
        finger.x = x; finger.y = y;
        if (hooks.onGrab) hooks.onGrab();
        return true;
      }
      return false;
    },

    move(x, y) {
      finger.x = x; finger.y = y;
    },

    // La pièce glisse au-dessus du doigt pour rester visible.
    update(dt) {
      if (!drag) return;
      drag.offY += (-params.lift_offset - drag.offY) * Math.min(1, dt * 14);
      drag.x = finger.x;
      drag.y = finger.y + drag.offY;
    },

    up() {
      if (!drag) return;
      const { comp, what, x, y } = drag;
      drag = null;
      comp.held = false;
      if (what === 'old') {
        if (!onBoard(x, y)) {
          comp.removed = true;
          if (hooks.onRemove) hooks.onRemove(comp);
        } else if (hooks.onStay) hooks.onStay();
        return;
      }
      // un condensateur neuf va sur n'importe quel emplacement vide (le plus proche)
      let spot = null;
      let best = params.snap_radius;
      for (const c of rep.fragile) {
        if (!c.removed) continue;
        const d = Math.hypot(x - c.x, y - c.y);
        if (d <= best) { best = d; spot = c; }
      }
      if (spot) {
        spot.broken = false;
        spot.removed = false;
        spot.wear = 0;
        rep.partsUsed = (rep.partsUsed || 0) + 1;
        if (hooks.onPlace) hooks.onPlace(spot);
      } else if (hooks.onMiss) hooks.onMiss();
    },
  };
}
