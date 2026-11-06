// Aspirateur micro : frotter la rouille (grille de cellules dont l'opacité baisse à chaque passage).
// Il faut bouger assez vite (pas de simple tapotement). Frotter un composant fragile l'abîme.
// L'embout flotte au-dessus du doigt (offset_y) pour que le pouce ne cache pas la zone.
export function createVacuum(rep, params, hooks = {}) {
  let active = false;
  let last = null;      // dernier point {x, y, t}
  let speed = 0;
  let warnT = 0;
  let suckT = 0;
  const pos = { x: 0, y: 0 };

  function overlapsRect(x, y, r, c) {
    const nx = Math.max(c.x - c.w / 2, Math.min(x, c.x + c.w / 2));
    const ny = Math.max(c.y - c.h / 2, Math.min(y, c.y + c.h / 2));
    return Math.hypot(x - nx, y - ny) <= r;
  }

  function rub(x, y, d, dt) {
    if (speed < params.min_speed) return;
    const r = params.radius;
    let cleaned = 0;
    for (const c of rep.rust.cells) {
      if (c.a <= 0) continue;
      const dd = Math.hypot(c.x - x, c.y - y);
      if (dd > r + params.cell / 2) continue;
      const k = dd < r * 0.6 ? 1 : 0.5;
      const before = c.a;
      c.a = Math.max(0, c.a - d * params.rate * k);
      if (c.a < 0.06) c.a = 0;
      cleaned += before - c.a;
      if (before > 0 && c.a === 0 && hooks.onCellClean) hooks.onCellClean(c);
    }
    if (cleaned > 0) suckT = 0.15;
    for (const comp of rep.fragile) {
      if (comp.broken || comp.removed || !overlapsRect(x, y, r * params.fragile_hit, comp)) continue;
      if (comp.wear === 0 || warnT <= 0) {
        warnT = params.fragile_warn_cooldown;
        if (hooks.onFragileTouch) hooks.onFragileTouch(comp);
      }
      comp.wear += dt;
      if (comp.wear >= params.fragile_grace) {
        comp.broken = true;
        comp.breaks++;
        rep.faults.add('capacitor_' + comp.i);
        if (hooks.onFragileBreak) hooks.onFragileBreak(comp);
      }
    }
  }

  return {
    get active() { return active; },
    get pos() { return pos; },
    get sucking() { return suckT > 0; },
    get speed() { return speed; },

    // Vrai si l'embout (au-dessus du doigt en x, y) toucherait de la rouille ou un composant fragile.
    covers(fx, fy) {
      const x = fx, y = fy - params.offset_y;
      for (const c of rep.rust.cells) if (c.a > 0.05 && Math.hypot(c.x - x, c.y - y) < params.cell) return true;
      return rep.fragile.some((c) => !c.broken && !c.removed && overlapsRect(x, y, 10, c));
    },

    down(fx, fy) {
      const x = fx, y = fy - params.offset_y;
      active = true;
      pos.x = x; pos.y = y;
      last = { x, y, t: performance.now() };
      speed = 0;
      if (hooks.onStart) hooks.onStart();
      return true;
    },

    move(fx, fy) {
      if (!active) return;
      const x = fx, y = fy - params.offset_y;
      const now = performance.now();
      const dt = Math.max(0.001, (now - last.t) / 1000);
      const d = Math.hypot(x - last.x, y - last.y);
      speed = speed * 0.6 + (d / dt) * 0.4;
      pos.x = x; pos.y = y;
      rub(x, y, d, Math.min(dt, 0.05));
      last = { x, y, t: now };
    },

    update(dt) {
      if (warnT > 0) warnT -= dt;
      if (suckT > 0) suckT -= dt;
      if (active && last && performance.now() - last.t > 120) speed *= Math.pow(0.02, dt);
    },

    up() {
      active = false;
      last = null;
      speed = 0;
    },
  };
}

// Part de rouille retirée (0 → 1). 1 s'il n'y a pas de rouille.
export function rustCleaned(rep) {
  const r = rep.rust;
  if (!r || r.total <= 0) return 1;
  let left = 0;
  for (const c of r.cells) left += c.a;
  return 1 - left / r.total;
}
