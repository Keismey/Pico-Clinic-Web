// Canvas au monde logique 1080 × 1920, mis à l'échelle de l'écran (devicePixelRatio plafonné à 2).
export const W = 1080;
export const H = 1920;

export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d');

let scale = 1;

export function resize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const s = Math.min(vw / W, vh / H);
  const cssW = Math.floor(W * s);
  const cssH = Math.floor(H * s);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));
  scale = canvas.width / W;
}

// À appeler au début de chaque image : on dessine ensuite en coordonnées logiques.
export function beginFrame() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, W, H);
}

// Position d'un doigt en coordonnées logiques.
export function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * W / r.width,
    y: (e.clientY - r.top) * H / r.height,
  };
}
