// Remplacement de puce, avec la pince :
// 1) sortir la puce grillée de la carte (elle part dans la coupelle) ;
// 2) prendre la puce neuve dans la boîte, la glisser sur l'emplacement et relâcher.
// Aimantation dans snap_radius ; score d'alignement = 1 - distance / rayon.
import { D, TRAY } from '../drone.js';

const BOX_SCALE = 0.6;
const TRAY_SCALE = 0.35;

export function createChip(chip, params, hooks = {}) {
  let drag = null;
  let inSnap = false;
  const finger = { x: 0, y: 0 };
  const half = D.chip.s / 2;

  // une puce interrompue (relance après la toux) retrouve une place stable
  for (const p of [chip.old, chip.neu]) {
    if (p.state === 'drag') p.state = 'loose';
    if (p.fly) { p.x = p.fly.toX; p.y = p.fly.toY; p.state = p.fly.then; p.fly = null; }
  }

  function onBoard(p) {
    return Math.abs(p.x - D.cx) < D.board && Math.abs(p.y - D.cy) < D.board;
  }

  function fly(p, toX, toY, then, dur = 0.45) {
    p.fly = { t: 0, dur, fromX: p.x, fromY: p.y, toX, toY, then };
    p.state = 'fly';
  }

  function slotDist(p) {
    return Math.hypot(p.x - D.slot.x, p.y - D.slot.y);
  }

  function hit(p, x, y, scale) {
    return Math.abs(x - p.x) < half * scale + params.grab_pad && Math.abs(y - p.y) < half * scale + params.grab_pad;
  }

  return {
    get dragging() { return drag && drag.p; },
    get dragOld() { return !!drag && drag.p === chip.old; },
    get dragNew() { return !!drag && drag.p === chip.neu; },

    // éclairage du cadre : 0 → 1 en approchant, 1 dans la zone d'aimantation
    get slotGlow() {
      if (!drag || drag.p !== chip.neu) return 0;
      const d = slotDist(chip.neu);
      if (d <= params.snap_radius) return 1;
      return Math.max(0, 1 - (d - params.snap_radius) / (params.snap_radius * 5)) * 0.8;
    },

    down(x, y) {
      let p = null;
      if (chip.old.state === 'slot' && hit(chip.old, x, y, 1)) p = chip.old;
      else if (chip.neu.state === 'box' && hit(chip.neu, x, y, BOX_SCALE)) p = chip.neu;
      else if (chip.neu.state === 'loose' && hit(chip.neu, x, y, 1)) p = chip.neu;
      if (!p) return false;
      drag = { p, offX: p.x - x, offY: p.y - y };
      finger.x = x; finger.y = y;
      p.state = 'drag';
      inSnap = false;
      if (hooks.onGrab) hooks.onGrab(p === chip.old);
      return true;
    },

    move(x, y) {
      finger.x = x; finger.y = y;
    },

    update(dt) {
      for (const p of [chip.old, chip.neu]) {
        if (!p.fly) continue;
        const f = p.fly;
        f.t = Math.min(1, f.t + dt / f.dur);
        const e = f.t < 0.5 ? 2 * f.t * f.t : 1 - Math.pow(-2 * f.t + 2, 2) / 2;
        p.x = f.fromX + (f.toX - f.fromX) * e;
        p.y = f.fromY + (f.toY - f.fromY) * e - Math.sin(Math.PI * e) * (f.then === 'tray' ? 220 : 60);
        if (f.t >= 1) { p.state = f.then; p.fly = null; }
      }
      if (!drag) return;
      // la puce glisse au-dessus du doigt pour rester visible
      const k = Math.min(1, dt * 14);
      drag.offX += (0 - drag.offX) * k;
      drag.offY += (-params.lift_offset - drag.offY) * k;
      const p = drag.p;
      p.x = Math.max(half, Math.min(1080 - half, finger.x + drag.offX));
      p.y = Math.max(300, Math.min(1320, finger.y + drag.offY));
      if (p === chip.neu && chip.old.state !== 'slot') {
        const now = slotDist(p) <= params.snap_radius;
        if (now && !inSnap && hooks.onSnapEnter) hooks.onSnapEnter();
        inSnap = now;
      }
    },

    up() {
      if (!drag) return;
      const p = drag.p;
      drag = null;
      if (p === chip.old) {
        if (!onBoard(p)) {
          fly(p, TRAY.x, TRAY.y, 'tray', 0.55);
          if (hooks.onRemove) hooks.onRemove();
        } else {
          fly(p, D.slot.x, D.slot.y, 'slot', 0.25);
          if (hooks.onStay) hooks.onStay();
        }
        return;
      }
      const d = slotDist(p);
      if (chip.old.state === 'slot' || chip.old.state === 'fly') {
        fly(p, D.box.x, D.box.y, 'box');
        if (d < params.snap_radius * 4 && hooks.onBlocked) hooks.onBlocked();
        return;
      }
      if (d <= params.snap_radius) {
        chip.score = Math.max(0, 1 - d / params.snap_radius);
        p.x = D.slot.x; p.y = D.slot.y;
        p.state = 'placed';
        if (hooks.onPlace) hooks.onPlace(chip.score);
      } else if (onBoard(p)) {
        p.state = 'loose';
        if (hooks.onMiss) hooks.onMiss();
      } else {
        fly(p, D.box.x, D.box.y, 'box');
      }
    },

    scaleOf(p) {
      if (p.state === 'box') return BOX_SCALE;
      if (p.state === 'tray') return TRAY_SCALE;
      if (p.state === 'fly') {
        const f = p.fly;
        const target = f.then === 'tray' ? TRAY_SCALE : f.then === 'box' ? BOX_SCALE : 1;
        return 1 + (target - 1) * f.t;
      }
      return 1;
    },
  };
}
