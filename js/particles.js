// Particules légères (étincelles, fumée). Maximum 150 à la fois.
const MAX = 150;
const list = [];

export function spawn(x, y, opts = {}) {
  const {
    count = 8, color = '#ffd36b', speed = 300, life = 0.6,
    size = 8, gravity = 600, kind = 'spark', spread = Math.PI * 2, dir = 0, tag = null,
  } = opts;
  for (let i = 0; i < count && list.length < MAX; i++) {
    const a = dir + (Math.random() - 0.5) * spread;
    const v = speed * (0.4 + Math.random() * 0.6);
    list.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life, max: life, size: size * (0.6 + Math.random() * 0.8), color, gravity, kind, tag,
    });
  }
}

export function update(dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) { list.splice(i, 1); continue; }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === 'smoke') { p.vx *= 0.97; p.size += 40 * dt; }
  }
}

export function draw(ctx) {
  for (const p of list) {
    const k = p.life / p.max;
    ctx.globalAlpha = p.kind === 'smoke' ? k * 0.55 : k;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function clear() {
  list.length = 0;
}

// Retire seulement les particules d'une étiquette (ex. fumée de la puce quand une vue rapprochée s'ouvre).
export function clearTag(tag) {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].tag === tag) list.splice(i, 1);
}
