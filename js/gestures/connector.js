// Geste du connecteur : glisser la fiche jusqu'à sa prise et relâcher.
// Aimantation dans un rayon snap_radius, aucune erreur possible.
import { D } from '../drone.js';

export function createConnector(plug, params, hooks = {}) {
  let drag = null;
  const finger = { x: 0, y: 0 };

  function place(x, y) {
    const b = D.board;
    x = Math.max(D.cx - b + 50, Math.min(D.cx + b - 50, x));
    y = Math.max(D.cy - b + 40, Math.min(D.cy + b - 40, y));
    // le câble a une longueur maximale
    const A = D.anchor;
    const d = Math.hypot(x - A.x, y - A.y);
    if (d > D.cableMax) {
      x = A.x + (x - A.x) * D.cableMax / d;
      y = A.y + (y - A.y) * D.cableMax / d;
    }
    plug.x = x;
    plug.y = y;
  }

  function socketDist() {
    return Math.hypot(plug.x - D.socket.x, plug.y - D.socket.y);
  }

  return {
    get dragging() { return !!drag; },

    // 0 → 1 quand la fiche approche de la prise (pour l'éclairer).
    get glow() {
      if (!drag) return 0;
      return Math.max(0, 1 - socketDist() / 160);
    },

    down(x, y) {
      if (plug.connected || plug.pop) return false;
      if (Math.hypot(x - plug.x, y - plug.y) > params.grab_radius) return false;
      drag = { offX: plug.x - x, offY: plug.y - y };
      finger.x = x; finger.y = y;
      plug.lift = true;
      if (hooks.onGrab) hooks.onGrab();
      return true;
    },

    move(x, y) {
      finger.x = x; finger.y = y;
    },

    // La fiche glisse au-dessus du doigt pour rester visible.
    update(dt) {
      if (!drag) return;
      const k = Math.min(1, dt * 14);
      drag.offX += (0 - drag.offX) * k;
      drag.offY += (-params.lift_offset - drag.offY) * k;
      place(finger.x + drag.offX, finger.y + drag.offY);
    },

    up() {
      if (!drag) return;
      drag = null;
      plug.lift = false;
      if (socketDist() <= params.snap_radius) {
        plug.connected = true;
        plug.x = D.socket.x;
        plug.y = D.socket.y;
        if (hooks.onConnect) hooks.onConnect();
      }
    },
  };
}
