// Outils d'interface : couleurs, police, boutons, texte avec retour à la ligne.
import { W, H } from './canvas.js';
import { vibrate } from './feedback.js';
import { sfx } from './audio.js';

export const C = {
  copper: '#c47a3c',
  copperDark: '#8f5426',
  turquoise: '#3fd0bb',
  turquoiseDark: '#25a08d',
  orange: '#ff8a3d',
  orangeDark: '#c4622a',
  cream: '#f4e9d8',
  paper: '#fff7ec',
  ink: '#3a2a1e',
  inkSoft: '#7a6350',
  red: '#d64545',
  green: '#3cbf6a',
};

// V4b — Options d'accessibilité lues au dessin (contrastes forts, gaucher).
export const ACCESS = { contrast: false, lefty: false };
const SOFT = { inkSoft: C.inkSoft, copper: C.copper, turquoiseDark: C.turquoiseDark };

export function font(size, weight = 700) {
  return `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function easeInOut(k) {
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
}

// Découpe un texte en lignes qui tiennent dans maxW (respecte aussi les \n).
export function wrapLines(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

// Texte centré verticalement autour de cy, avec retour à la ligne automatique.
export function drawText(ctx, text, x, cy, maxW, size, opts = {}) {
  const { color = C.ink, weight = 700, align = 'center', stroke = null, maxH = 0 } = opts;
  const k = (opts.lineH || size * 1.25) / size; // interligne proportionnel à la taille
  let lineH = size * k;
  ctx.font = font(size, weight);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  let lines = wrapLines(ctx, text, maxW);
  // maxH : le texte rétrécit tant qu'il ne tient pas dans cette hauteur
  while (maxH && lines.length * lineH > maxH && size > 26) {
    size -= 2;
    lineH = size * k;
    ctx.font = font(size, weight);
    lines = wrapLines(ctx, text, maxW);
  }
  let y = cy - ((lines.length - 1) * lineH) / 2;
  for (const l of lines) {
    if (stroke) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.22;
      ctx.strokeStyle = stroke;
      ctx.strokeText(l, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(l, x, y);
    y += lineH;
  }
}

// Texte sur une ligne qui rétrécit si besoin pour tenir dans maxW.
export function fitText(ctx, text, x, y, maxW, size, color = C.ink, weight = 800) {
  let s = size;
  ctx.font = font(s, weight);
  while (ctx.measureText(text).width > maxW && s > 20) {
    s -= 2;
    ctx.font = font(s, weight);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// Texte foncé sur l'orange et le turquoise : 5,9:1 et 7,2:1 (le blanc n'y donnait que 2,4:1 et 1,9:1).
export const STYLES = {
  primary: { fill: C.orange, shadow: C.orangeDark, text: C.ink },
  secondary: { fill: C.paper, shadow: '#d9c3a3', text: C.ink },
  on: { fill: C.turquoise, shadow: C.turquoiseDark, text: C.ink },
};

// Contrastes forts : textes secondaires plus foncés, boutons cerclés, panneaux opaques.
export function setContrast(on) {
  ACCESS.contrast = !!on;
  C.inkSoft = on ? '#3d2c1f' : SOFT.inkSoft;
  C.copper = on ? '#9a5520' : SOFT.copper;
  C.turquoiseDark = on ? '#13705f' : SOFT.turquoiseDark;
  STYLES.secondary.fill = on ? '#ffffff' : C.paper;
  STYLES.secondary.shadow = on ? '#3a2a1e' : '#d9c3a3';
  // orange et turquoise gardent leur teinte (le texte foncé y est plus lisible que du blanc sur une teinte foncée)
  STYLES.on.shadow = on ? '#073f37' : C.turquoiseDark;
  STYLES.primary.shadow = on ? '#7a3208' : C.orangeDark;
}

let pulseClock = 0;
export function tickUI(dt) {
  pulseClock += dt;
}

export function drawButton(ctx, b, pressed) {
  const st = STYLES[(b.selected && b.selected()) ? 'on' : (b.style || 'primary')];
  const depth = 12;
  const push = pressed ? depth - 3 : 0;
  const pulse = b.pulse ? 1 + 0.03 * Math.sin(pulseClock * 6) : 1;
  ctx.save();
  if (b.alpha !== undefined) ctx.globalAlpha *= b.alpha;
  ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
  ctx.scale(pulse, pulse);
  ctx.translate(-b.w / 2, -b.h / 2);
  ctx.fillStyle = st.shadow;
  roundRect(ctx, 0, depth, b.w, b.h - depth, 36);
  ctx.fill();
  ctx.fillStyle = st.fill;
  roundRect(ctx, 0, push, b.w, b.h - depth, 36);
  ctx.fill();
  if (ACCESS.contrast) { ctx.strokeStyle = C.ink; ctx.lineWidth = 5; ctx.stroke(); }
  if (b.wrap) wrapLabel(ctx, b.label(), b.w / 2, push + (b.h - depth) / 2 + 2, b.w - 40, b.size || 60, st.text);
  else fitText(ctx, b.label(), b.w / 2, push + (b.h - depth) / 2 + 2, b.w - 48, b.size || 60, st.text);
  ctx.restore();
}

// Libellé sur une ou deux lignes (bouton avec « wrap: true ») : la taille baisse tant que ça ne tient pas.
function wrapLabel(ctx, text, x, cy, maxW, size, color) {
  let s = size;
  let lines;
  for (;;) {
    ctx.font = font(s, 800);
    lines = wrapLines(ctx, text, maxW);
    if ((lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= maxW)) || s <= 20) break;
    s -= 2;
  }
  const lh = s * 1.15;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  lines.forEach((l, i) => ctx.fillText(l, x, cy + (i - (lines.length - 1) / 2) * lh));
}

// b.hit (facultatif) : zone de toucher plus grande que le bouton dessiné ({ x, y, w, h }).
function hit(b, x, y) {
  const r = b.hit || b;
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// Un groupe de boutons : appui, relâchement sur le bouton = action.
export class Buttons {
  constructor() {
    this.list = [];
    this.pressed = null;
  }

  add(b) {
    this.list.push(b);
    return b;
  }

  pointer(type, x, y) {
    if (type === 'down') {
      const b = this.list.find((bb) => bb.visible !== false && hit(bb, x, y));
      if (b) { this.pressed = b; return true; }
      return false;
    }
    if (type === 'move') return !!this.pressed;
    const b = this.pressed;
    this.pressed = null;
    if (!b) return false;
    if (type === 'up' && hit(b, x, y) && b.visible !== false) {
      vibrate(10);
      if (!b.silent) sfx('click');
      b.onTap();
    }
    return true;
  }

  draw(ctx) {
    for (const b of this.list) if (b.visible !== false) drawButton(ctx, b, b === this.pressed);
  }
}

// Fonds d'écran.
export function drawCreamBackground(ctx) {
  const g = ctx.createRadialGradient(W / 2, H * 0.4, 100, W / 2, H * 0.4, H * 0.8);
  g.addColorStop(0, '#fff6e6');
  g.addColorStop(1, '#ead8bb');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function drawMatBackground(ctx) {
  drawCreamBackground(ctx);
  ctx.fillStyle = 'rgba(63, 208, 187, 0.10)';
  roundRect(ctx, 30, 260, W - 60, 1080, 50);
  ctx.fill();
  ctx.strokeStyle = 'rgba(63, 160, 150, 0.18)';
  ctx.lineWidth = 2;
  for (let x = 90; x < W - 30; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 270); ctx.lineTo(x, 1330); ctx.stroke();
  }
  for (let y = 290; y < 1340; y += 60) {
    ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W - 40, y); ctx.stroke();
  }
}

// Panneau d'aide en bas d'écran.
export function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = ACCESS.contrast ? '#ffffff' : 'rgba(255, 250, 242, 0.92)';
  roundRect(ctx, x, y, w, h, 40);
  ctx.fill();
  ctx.strokeStyle = ACCESS.contrast ? C.ink : 'rgba(196, 122, 60, 0.35)';
  ctx.lineWidth = ACCESS.contrast ? 5 : 4;
  ctx.stroke();
}

// Message bref qui apparaît puis s'efface.
export function drawToast(ctx, text, x, y, k, color) {
  const a = Math.min(1, k * 3);
  const pop = 1 + Math.max(0, (k - 0.8)) * 1.2;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.scale(pop, pop);
  drawText(ctx, text, 0, 0, 900, 84, { color, weight: 900, stroke: '#fff' });
  ctx.restore();
}
