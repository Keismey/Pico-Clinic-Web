// Défi du jour : texte à partager (sans rien dévoiler de la réparation) et partage du résultat.
// Téléphone : partage natif (navigator.share) avec une image du résultat + le texte.
// Si l'image n'est pas acceptée : texte seul. Sinon, ou s'il échoue : copie dans le presse-papiers.
import { W } from './canvas.js';
import { t, getLang } from './i18n.js';
import { C, font, fitText, roundRect } from './ui.js';
import { dayEntry, drawBadge } from './daily.js';

// Page du jeu sur Google Play (la version web n'existe plus).
const SHARE_URL = 'https://play.google.com/store/apps/details?id=com.keismey.picoclinic';
const MEDAL = ['🔧', '🥉', '🥈', '🥇']; // 0 = patient pas réparé, 1 bronze, 2 argent, 3 or

// Illustration du jeu, préchargée pour que l'image soit prête au moment du clic.
const cover = new Image();
cover.src = 'couverture.webp';

// « 1:42 », comme dans le reste du jeu.
function fmt(sec) {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Au moins un essai joué ce jour-là : le bouton « Partager » peut apparaître.
export function canShare(key) {
  const e = dayEntry(key);
  return !!e && e.tries > 0;
}

// Les morceaux du résultat, utilisés par le texte et par l'image.
function resultParts(key) {
  const e = dayEntry(key);
  if (!e) return null;
  const [, m, d] = key.split('-').map(Number);
  const date = t('daily.share.date', { d, m: t('daily.share.m.' + m) });
  const badge = e.stars[0] ? e.best : 0;
  const stars = e.stars.map((on) => (on ? '⭐' : '☆')).join('');
  const timeText = e.time !== null && e.time !== undefined ? fmt(e.time) : '';
  const triesText = e.tries <= 1 ? t('daily.share.try1') : t('daily.share.tries', { n: e.tries });
  const parts = [MEDAL[badge] + ' ' + stars];
  if (timeText) parts.push(timeText);
  parts.push(triesText);
  return { head: t('daily.share.head', { d: date }), badge, starsOn: e.stars.slice(), timeText, triesText, line: parts.join(' · ') };
}

// Le texte partagé : date, médaille, étoiles et temps du meilleur essai, essais utilisés, lien.
export function shareText(key) {
  const p = resultParts(key);
  if (!p) return '';
  return [p.head, p.line, SHARE_URL + '&hl=' + getLang()].join('\n');
}

// Couleurs fixes : l'image est la même pour tout le monde, même avec l'option « contrastes forts ».
const PAL = {
  wood: '#c47a3c', woodDark: '#8f5426', paper: '#fff7ec', ink: '#3a2a1e', line: '#d9c3a3',
  teal: '#3fd0bb', tealDark: '#25a08d', gold: '#f2c14e', goldDark: '#a87a12', starOff: '#efe2cc',
};

// Étoile à 5 branches, pleine (or) ou vide (beige).
function drawStar(g, cx, cy, R, on) {
  g.save();
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? R * 0.48 : R;
    if (i) g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
  g.lineJoin = 'round';
  g.lineWidth = R * 0.16;
  g.fillStyle = on ? PAL.gold : PAL.starOff;
  g.strokeStyle = on ? PAL.goldDark : PAL.line;
  g.fill();
  g.stroke();
  g.restore();
}

// Petit chronomètre dessiné (centre x, y ; rayon r), pour ne pas dépendre d'un emoji.
function drawStopwatch(g, x, y, r) {
  g.save();
  g.strokeStyle = PAL.ink;
  g.lineWidth = r * 0.18;
  g.lineCap = 'round';
  g.beginPath(); g.arc(x, y + r * 0.12, r * 0.85, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(x - r * 0.3, y - r * 0.95); g.lineTo(x + r * 0.3, y - r * 0.95); g.stroke();
  g.beginPath(); g.moveTo(x, y + r * 0.12); g.lineTo(x + r * 0.4, y - r * 0.25); g.stroke();
  g.restore();
}

// L'image partagée (1080 de large) : l'illustration entière en haut, puis la médaille du jeu,
// les 3 étoiles, le temps, les essais et le nom du jeu sur un fond crème.
function shareImage(key) {
  const p = resultParts(key);
  if (!p) return Promise.resolve(null);
  const S = 1080;
  const ready = cover.complete && cover.naturalWidth > 0;
  const top = ready ? Math.round((cover.naturalHeight * S) / cover.naturalWidth) : 567; // hauteur de l'illustration
  const H = top + 790;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = H;
  const g = c.getContext('2d');

  // fond crème
  const bg = g.createLinearGradient(0, top, 0, H);
  bg.addColorStop(0, '#fff6e6');
  bg.addColorStop(1, '#ead8bb');
  g.fillStyle = bg;
  g.fillRect(0, 0, S, H);

  // illustration entière en haut (ou, à défaut, un bandeau avec le nom du jeu)
  if (ready) {
    g.drawImage(cover, 0, 0, S, top);
  } else {
    g.fillStyle = PAL.wood;
    g.fillRect(0, 0, S, top);
    fitText(g, 'Pico-Clinic', S / 2, top / 2, S - 200, 150, '#fff', 900);
  }
  g.fillStyle = PAL.woodDark;
  g.fillRect(0, top - 4, S, 10);
  const sh = g.createLinearGradient(0, top + 6, 0, top + 34);
  sh.addColorStop(0, 'rgba(58,42,30,0.18)');
  sh.addColorStop(1, 'rgba(58,42,30,0)');
  g.fillStyle = sh;
  g.fillRect(0, top + 6, S, 28);

  // titre du jour
  fitText(g, p.head, S / 2, top + 75, S - 120, 56, PAL.ink, 900);

  // médaille du jeu (emplacement pointillé si le patient n'est pas réparé) et étoiles
  drawBadge(g, S / 2, top + 225, 105, p.badge, 0.5);
  for (let i = 0; i < 3; i++) drawStar(g, S / 2 + (i - 1) * 140, top + 450, 54, !!p.starsOn[i]);

  // pastilles : temps (avec chronomètre) et nombre d'essais
  const PH = 96, GAP = 28, PAD = 44, ICON = 62, rowY = top + 570;
  g.font = font(54, 800);
  const items = [];
  if (p.timeText) items.push({ text: p.timeText, icon: true });
  items.push({ text: p.triesText, icon: false });
  for (const it of items) it.w = Math.ceil(g.measureText(it.text).width) + PAD * 2 + (it.icon ? ICON : 0);
  let x = (S - items.reduce((a, it) => a + it.w, 0) - GAP * (items.length - 1)) / 2;
  for (const it of items) {
    g.fillStyle = PAL.paper;
    roundRect(g, x, rowY - PH / 2, it.w, PH, PH / 2);
    g.fill();
    g.strokeStyle = PAL.line;
    g.lineWidth = 4;
    g.stroke();
    if (it.icon) drawStopwatch(g, x + PAD + 22, rowY + 2, 22);
    g.font = font(54, 800);
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = PAL.ink;
    g.fillText(it.text, x + PAD + (it.icon ? ICON : 0), rowY + 3);
    x += it.w + GAP;
  }

  // nom du jeu et boutique, sur un bouton turquoise comme dans le jeu
  const BW = 800, BH = 96, bx = (S - BW) / 2, by = top + 650;
  g.fillStyle = PAL.tealDark;
  roundRect(g, bx, by + 10, BW, BH, 40);
  g.fill();
  g.fillStyle = PAL.teal;
  roundRect(g, bx, by, BW, BH, 40);
  g.fill();
  fitText(g, 'Pico-Clinic · Google Play', S / 2, by + BH / 2 + 2, BW - 60, 42, '#fff', 900);

  return new Promise((res) => {
    try { c.toBlob((b) => res(b), 'image/png'); } catch (e) { res(null); }
  });
}

// Copie dans le presse-papiers ; repli sur l'ancienne méthode si l'API moderne n'existe pas.
async function copy(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* on essaie l'autre méthode */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-1000px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return !!ok;
  } catch (e) {
    return false;
  }
}

// Message « Résultat copié ! » : une pastille qui recouvre un instant la rangée de boutons du bas (k : 1 → 0).
const TOASTS = { copied: 'daily.share.copied', 'text-copied': 'daily.share.text_copied', failed: 'daily.share.failed' };
export function shareToast(r) {
  return TOASTS[r] ? { key: TOASTS[r], t: 2, max: 2 } : null;
}

// Après un partage avec image, certaines applis (Threads…) oublient le texte : le bouton propose alors
// de le copier pour le coller à la main. Renvoie 'text-copied' | 'failed'.
export async function copyResultText(key) {
  const text = shareText(key);
  return text && (await copy(text)) ? 'text-copied' : 'failed';
}

// Bouton « Partager mon résultat » des écrans du Défi du jour ; après un partage avec image, il devient
// « Copier le texte » le temps d'un appui. onToast reçoit la pastille à afficher (ou null).
export function shareButton(key, onToast) {
  let copyNext = false;
  return {
    label: () => t(copyNext ? 'daily.share.copy_btn' : 'daily.share.btn'),
    onTap: async () => {
      if (copyNext) { copyNext = false; onToast(shareToast(await copyResultText(key))); return; }
      const r = await shareResult(key);
      if (r === 'shared-image') copyNext = true;
      onToast(shareToast(r));
    },
  };
}

export function drawShareToast(ctx, toast) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, (toast.t / toast.max) * 4);
  ctx.fillStyle = toast.key === 'daily.share.failed' ? C.red : C.turquoiseDark;
  roundRect(ctx, 50, 1700, W - 100, 150, 36); // même emplacement que la rangée de boutons, qu'elle recouvre
  ctx.fill();
  fitText(ctx, t(toast.key), W / 2, 1775, W - 200, 60, '#fff', 900);
  ctx.restore();
}

// Appli Android : la WebView n'a pas navigator.share ; on passe par les modules Capacitor « Share » et « Filesystem »
// (l'image est écrite dans le cache de l'appli, puis donnée à la feuille de partage d'Android).
function nativeShare() {
  const C = window.Capacitor;
  const P = C && C.Plugins;
  return C && C.isNativePlatform && C.isNativePlatform() && P && P.Share && P.Filesystem ? P : null;
}

function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] || '');
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

async function shareNative(P, key, text) {
  const cancelled = (e) => /cancel/i.test(String((e && (e.message || e.errorMessage)) || e));
  try {
    const blob = await shareImage(key);
    if (blob) {
      const w = await P.Filesystem.writeFile({ path: 'pico-clinic-defi.png', data: await blobToBase64(blob), directory: 'CACHE' });
      await P.Share.share({ text, files: [w.uri], dialogTitle: 'Pico-Clinic' });
      return 'shared-image';
    }
  } catch (e) {
    if (cancelled(e)) return 'cancelled';
    // échec avec l'image : on retente en texte seul
  }
  try {
    await P.Share.share({ text, dialogTitle: 'Pico-Clinic' });
    return 'shared';
  } catch (e) {
    return cancelled(e) ? 'cancelled' : null;
  }
}

let busy = false;

// Renvoie 'shared-image' | 'shared' | 'cancelled' | 'copied' | 'failed' | 'busy'.
// Annuler le partage natif n'est pas une erreur : on ne copie rien et on n'affiche rien.
export async function shareResult(key) {
  if (busy) return 'busy'; // la feuille de partage est déjà ouverte
  const text = shareText(key);
  if (!text) return 'failed';
  busy = true;
  try {
    const P = nativeShare();
    if (P) {
      const r = await shareNative(P, key, text);
      if (r) return r;
    }
    if (typeof navigator.share === 'function') {
      // 1) image + texte, si l'appareil accepte les fichiers
      try {
        const blob = await shareImage(key);
        if (blob) {
          const file = new File([blob], 'pico-clinic.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text });
            return 'shared-image';
          }
        }
      } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelled';
        // échec avec l'image : on retente en texte seul
      }
      // 2) texte seul
      try {
        await navigator.share({ text });
        return 'shared';
      } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelled';
      }
    }
    return (await copy(text)) ? 'copied' : 'failed';
  } finally {
    busy = false;
  }
}
