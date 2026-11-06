// Loupe de diagnostic : la loupe flotte au-dessus du doigt.
// Garder une pièce dans la loupe 0,4 s la révèle : panne cachée trouvée, ou « rien ici » (coûte du temps).
export function createMagnifier(rep, targets, params, hooks = {}) {
  let active = false;
  let target = null;
  let hold = 0;
  const lens = { x: 0, y: 0 };

  function place(x, y) {
    lens.x = Math.max(params.radius, Math.min(1080 - params.radius, x));
    lens.y = Math.max(params.radius + 20, y - params.offset_y);
  }

  function nearest() {
    let best = null;
    let bd = params.catch_radius;
    for (const tg of targets) {
      if (tg.done) continue;
      const d = Math.hypot(tg.x - lens.x, tg.y - lens.y);
      if (d < bd) { bd = d; best = tg; }
    }
    return best;
  }

  return {
    get active() { return active; },
    get lens() { return lens; },
    get target() { return target; },
    get progress() { return target ? Math.min(1, hold / params.hold) : 0; },

    down(x, y) {
      active = true;
      place(x, y);
      target = null;
      hold = 0;
      if (hooks.onStart) hooks.onStart();
      return true;
    },

    move(x, y) {
      if (active) place(x, y);
    },

    update(dt) {
      if (!active) return;
      const tg = nearest();
      if (tg !== target) { target = tg; hold = 0; }
      if (!target) return;
      hold += dt;
      if (hold >= params.hold) {
        target.done = true;
        if (target.kind === 'fault') {
          rep.diag.revealed.add(target.id);
          if (hooks.onReveal) hooks.onReveal(target);
        } else if (hooks.onNothing) {
          hooks.onNothing(target);
        }
        target = null;
        hold = 0;
      }
    },

    up() {
      active = false;
      target = null;
      hold = 0;
    },
  };
}
