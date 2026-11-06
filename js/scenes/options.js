// V4b — Fenêtre « Options » de l'appli (par-dessus l'écran en cours, onglets Son · Jeu · Partie) : volumes, vibrations, langue, puis tremblement réduit, gaucher,
// contrastes forts ; sauvegarde (exporter / importer), notes de mise à jour, (« Supprimer les pubs » à partir
// de la version 1.1), effacer la sauvegarde (deux confirmations), version et crédits.
// Plus de lien vers le hub ni le signalement de bug : l'appli est autonome. Le soutien Ko-fi n'existe que dans la version web
// (les règles de paiement de Google Play interdisent ce lien dans l'appli Android : il est masqué dès que Capacitor est natif).
// Ouvert depuis la liste des commandes, l'écran de fin, ou la pause d'une réparation (par-dessus la
// réparation : params.close au lieu d'un changement d'écran ; ni sauvegarde, ni notes, ni effacement,
// et la main gauche / droite ne se change pas en pleine réparation).
import { W, H } from '../canvas.js';
import { t, getLang } from '../i18n.js';
import { Buttons, C, drawText, fitText, roundRect, clamp, setContrast } from '../ui.js';
import { go } from '../scenes.js';
import { changeLang } from '../settings.js';
import { save, persist, resetSave } from '../save.js';
import { VERSION } from '../settings.js';
import { setMusicVol, setSfxVol, sfx } from '../audio.js';
import { vibrate } from '../feedback.js';
import { applyHand } from '../state.js';
import { drawGribouille } from '../portraits.js';
import { leftText } from './orders.js';

const X0 = 70, CW = W - 140;          // cartes des réglages
const SL = { x0: 120, x1: W - 120 };  // piste des curseurs de volume
// Onglets (comme la Boutique et le Carnet) : Son, Jeu, Partie. Dans la pause d'une réparation : Son et Jeu.
// Fenêtre centrée par-dessus l'écran (PY = haut de la fenêtre).
const PY = 300, PH = 1330;
const TABS = { x: 70, y: PY + 150, w: W - 140, h: 96 };
const TOP = PY + 280; // haut de la première carte sous les onglets
// Cartes de chaque onglet (hauteur) ; elles s'empilent sous les onglets, 24 px d'écart.
const PAGES = {
  sound: [['music', 190], ['sound', 190], ['vibration', 170]],
  game: [['lang', 170], ['tremor', 170], ['lefty', 170], ['contrast', 170]],
  save: [],
};
let ROWS = {};
function layout(page) {
  ROWS = {};
  let y = TOP;
  for (const [k, h] of PAGES[page]) { ROWS[k] = { y, h }; y += h + 24; }
}
const SLIDERS = { music: 'musicVol', sound: 'sfxVol' };
const TOGGLES = ['vibration', 'tremor', 'lefty', 'contrast'];

// Passer à true avec la version 1.1 (pubs + achat « Sans pubs ») : le bouton « Supprimer les pubs » apparaît.
const NO_ADS_BUTTON = false;

const KOFI_URL = 'https://ko-fi.com/keismey';
const isApp = () => { const C = window.Capacitor; return !!(C && C.isNativePlatform && C.isNativePlatform()); };

let buttons, from, time, drag, confirm, toast;
let page = 'sound';
let close = null; // fonction qui referme la fenêtre
let repair = false; // ouverte depuis la pause d'une réparation

const sliderY = (k) => ROWS[k].y + 122;

function setVol(k, v) {
  v = Math.round(clamp(v, 0, 1) * 20) / 20; // pas de 5 %
  if (k === 'music') setMusicVol(v); else setSfxVol(v);
}

function toggle(k) {
  save.settings[k] = !save.settings[k];
  if (k === 'contrast') setContrast(save.settings.contrast);
  if (k === 'lefty') applyHand();
  if (k === 'vibration' && save.settings.vibration) vibrate(30);
  persist();
}

// Fenêtre de confirmation (étape 1 puis 2) pour effacer la sauvegarde.
function openConfirm(step) {
  const b = new Buttons();
  b.add({ x: 110, y: 1180, w: 400, h: 150, size: 46, style: 'secondary', label: () => t('opt.cancel'), onTap: () => { confirm = null; } });
  b.add({
    x: 570, y: 1180, w: 400, h: 150, size: step === 1 ? 46 : 40,
    label: () => t(step === 1 ? 'opt.erase_yes' : 'opt.erase_final'),
    onTap: () => {
      if (step === 1) { openConfirm(2); return; }
      resetSave();
      confirm = null;
      vibrate([30, 40, 30]);
      toast = { t: 2.4 };
    },
  });
  confirm = { step, buttons: b, time: 0 };
}

function card(ctx, r) {
  ctx.fillStyle = '#d9c3a3';
  roundRect(ctx, X0, r.y + 8, CW, r.h - 8, 30); ctx.fill();
  ctx.fillStyle = C.paper;
  roundRect(ctx, X0, r.y, CW, r.h - 8, 30); ctx.fill();
}

function drawSlider(ctx, k) {
  const v = save.settings[SLIDERS[k]] || 0;
  const y = sliderY(k);
  const x = SL.x0 + v * (SL.x1 - SL.x0);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#e2d0b4';
  ctx.lineWidth = 22;
  ctx.beginPath(); ctx.moveTo(SL.x0, y); ctx.lineTo(SL.x1, y); ctx.stroke();
  if (v > 0) {
    ctx.strokeStyle = C.turquoise;
    ctx.beginPath(); ctx.moveTo(SL.x0, y); ctx.lineTo(x, y); ctx.stroke();
  }
  const held = drag === k;
  ctx.fillStyle = C.copperDark;
  ctx.beginPath(); ctx.arc(x, y + 5, held ? 40 : 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = held ? C.orange : C.copper;
  ctx.beginPath(); ctx.arc(x, y, held ? 40 : 34, 0, Math.PI * 2); ctx.fill();
}

// Fenêtre « Sauvegarde » (commun/ks-studio.js, commune aux jeux du studio), habillée aux couleurs du jeu
// (feuille de style SAVE_CSS) et réduite au code : ni téléchargement ni choix d'un fichier dans l'appli.
const SAVE_CSS = '#ks-dlg{background:rgba(58,42,30,.55);color:#3a2a1e;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
  '#ks-dlg .kb{width:min(100%,400px);background:#f1e3cb;border:0;border-radius:22px;padding:22px 20px 14px;box-shadow:0 6px 0 #d9c3a3,0 14px 40px rgba(0,0,0,.35);outline:0}' +
  '#ks-dlg h2{color:#8f5426;font-size:24px;font-weight:900;margin:0 0 8px}' +
  '#ks-dlg p{color:#7a6350;font-size:15px;font-weight:700;opacity:1}' +
  '#ks-dlg textarea{background:#fff7ec;color:#3a2a1e;border:2px solid #d9c3a3;border-radius:14px;padding:10px;font:12px/1.35 ui-monospace,monospace}' +
  '#ks-dlg textarea::placeholder{color:#b49a80}' +
  '#ks-dlg button{background:#fff7ec;color:#3a2a1e;border-radius:16px;padding:13px 10px;font-size:17px;font-weight:900;box-shadow:0 5px 0 #d9c3a3;margin:0 0 14px}' +
  '#ks-dlg button.ks-main{background:#3fd0bb;color:#3a2a1e;box-shadow:0 5px 0 #25a08d}' +
  '#ks-dlg button#ks-close{background:#ff8a3d;box-shadow:0 5px 0 #c4622a}' +
  '#ks-dlg button:active{transform:translateY(4px);box-shadow:none}' +
  '#ks-dlg hr{border-top:2px dashed #d9c3a3;margin:6px 0 16px}' +
  '#ks-dlg .ks-err{color:#c0392b;font-weight:800}';

function openSaveDialog() {
  if (!window.KS) return;
  const l = getLang() === 'en' ? 'en' : 'fr';
  if (!document.getElementById('pico-save-css')) {
    const st = document.createElement('style');
    st.id = 'pico-save-css';
    st.textContent = SAVE_CSS;
    document.head.appendChild(st);   // après la feuille commune : elle l'emporte
  }
  window.KS.saveDialog({ jeu: 'Pico-Clinic', keys: ['pico_save_v1'], lang: l, save: persist, file: 'pico-clinic', accent: '#3fd0bb' });
  for (const id of ['ks-file', 'ks-pick', 'ks-f']) {
    const e = document.getElementById(id);
    if (e) e.remove();
  }
  // textes de l'appli (la fenêtre commune parle du navigateur et des fichiers)
  const intro = document.getElementById('ks-out-l');
  if (intro) intro.textContent = t('opt.save.intro');
  const paste = document.getElementById('ks-in-l');
  if (paste) paste.textContent = t('opt.save.paste');
  // la feuille commune peut être ajoutée après la nôtre : on remet la nôtre en dernier
  const mine = document.getElementById('pico-save-css');
  if (mine) document.head.appendChild(mine);
}

function tabs() {
  return repair ? ['sound', 'game'] : ['sound', 'game', 'save'];
}

// Boutons de l'onglet ouvert, puis Retour.
function build() {
  layout(page);
  buttons = new Buttons();
  const midY = (k) => ROWS[k].y + (ROWS[k].h - 8 - 128) / 2;
  if (ROWS.lang) {
    buttons.add({ x: 500, y: midY('lang'), w: 240, h: 128, size: 38, style: 'secondary', label: () => 'Français', selected: () => getLang() === 'fr', onTap: () => changeLang('fr') });
    buttons.add({ x: 755, y: midY('lang'), w: 240, h: 128, size: 38, style: 'secondary', label: () => 'English', selected: () => getLang() === 'en', onTap: () => changeLang('en') });
  }
  for (const k of TOGGLES) {
    if (!ROWS[k]) continue;
    if (repair && k === 'lefty') continue; // pas en pleine réparation (la boîte et la coupelle changeraient de côté)
    buttons.add({
      x: 775, y: midY(k), w: 210, h: 128, size: 40, style: 'secondary',
      label: () => t(save.settings[k] ? 'opt.on' : 'opt.off'),
      selected: () => !!save.settings[k],
      onTap: () => toggle(k),
    });
  }
  if (page === 'save') {
    const items = [
      { label: () => t('opt.save'), onTap: openSaveDialog },
      { label: () => t('opt.notes'), onTap: () => { const f = from; leave(); go('notes', { from: f }); } },
    ];
    // à brancher sur l'achat « Sans pubs » de Google Play (version 1.1)
    if (NO_ADS_BUTTON) items.push({ label: () => t('opt.noads'), onTap: () => {} });
    if (!isApp() && !repair) items.push({ label: () => t('opt.kofi'), onTap: () => { try { window.open(KOFI_URL, '_blank', 'noopener'); } catch (e) { /* lien bloqué */ } } });
    items.push({ label: () => t('opt.erase'), onTap: () => openConfirm(1) });
    items.forEach((it, i) => {
      buttons.add({ x: 70, y: TOP + i * 174, w: 940, h: 150, size: 46, style: 'secondary', label: it.label, onTap: it.onTap });
    });
  }
  buttons.add({ x: 240, y: PY + 1060, w: 600, h: 150, size: 58, label: () => t('opt.back'), onTap: leave });
}

function setPage(p) {
  if (p === page) return;
  page = p;
  drag = null;
  sfx('page');
  build();
}

function drawTabs(ctx) {
  const list = tabs();
  list.forEach((pg, i) => {
    const w = TABS.w / list.length, x = TABS.x + i * w, on = pg === page;
    ctx.fillStyle = on ? C.copperDark : 'rgba(196, 122, 60, 0.15)';
    roundRect(ctx, x + 4, TABS.y, w - 8, TABS.h, 30); ctx.fill();
    fitText(ctx, t('opt.tab.' + pg), x + w / 2, TABS.y + TABS.h / 2 + 2, w - 40, 42, on ? '#fff' : C.copperDark, 900);
  });
}

function leave() {
  if (close) close(); else go(from);
}

export default {
  init(params = {}) {
    from = params.from || from || 'orders'; // retour des notes de mise à jour : on garde l'écran d'origine
    close = params.close || null;
    repair = !!params.repair;
    time = 0;
    drag = null;
    confirm = null;
    toast = null;
    page = 'sound';
    build();
  },

  update(dt) {
    time += dt;
    if (confirm) confirm.time += dt;
    if (toast) { toast.t -= dt; if (toast.t <= 0) toast = null; }
  },

  draw(ctx) {
    // l'écran d'où l'on vient reste visible derrière, assombri
    ctx.fillStyle = 'rgba(58, 42, 30, 0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#d9c3a3';
    roundRect(ctx, 30, PY + 12, W - 60, PH, 44); ctx.fill();
    ctx.fillStyle = '#f1e3cb';
    roundRect(ctx, 30, PY, W - 60, PH, 44); ctx.fill();
    leftText(ctx, t('opt.title'), 80, PY + 80, 700, 76, C.copperDark, 900);
    drawGribouille(ctx, 930, PY + 76, 0.3, { time });
    drawTabs(ctx);

    for (const [k, r] of Object.entries(ROWS)) {
      card(ctx, r);
      if (k === 'lang') {
        leftText(ctx, t('opt.lang'), 100, r.y + (r.h - 8) / 2, 400, 46, C.ink, 800);
      } else if (SLIDERS[k]) {
        const v = Math.round((save.settings[SLIDERS[k]] || 0) * 100);
        leftText(ctx, t('opt.' + k), 100, r.y + 52, 600, 46, C.ink, 800);
        fitText(ctx, v ? t('opt.pct', { n: v }) : t('opt.muted'), 880, r.y + 52, 240, 42, v ? C.turquoiseDark : C.inkSoft, 900);
        drawSlider(ctx, k);
      } else {
        const locked = repair && k === 'lefty';
        leftText(ctx, t('opt.' + k), 100, r.y + 56, 680, 44, locked ? C.inkSoft : C.ink, 800);
        leftText(ctx, t(locked ? 'opt.lefty.locked' : 'opt.' + k + '.sub'), 100, r.y + 110, locked ? 900 : 680, 32, C.inkSoft, 700);
      }
    }
    buttons.draw(ctx);
    fitText(ctx, t('title.version', { v: VERSION }), W / 2, PY + 1252, W - 160, 28, C.inkSoft, 700);
    fitText(ctx, t('opt.credits'), W / 2, PY + 1290, W - 160, 26, C.inkSoft, 600);

    if (toast) {
      const a = Math.min(1, toast.t * 2);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = C.turquoiseDark;
      roundRect(ctx, 140, 1790, W - 280, 90, 45); ctx.fill();
      fitText(ctx, t('opt.erased'), W / 2, 1835, W - 340, 38, '#fff', 800);
      ctx.restore();
    }
    if (confirm) this.drawConfirm(ctx);
  },

  drawConfirm(ctx) {
    const k = Math.min(1, confirm.time * 5);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(58, 42, 30, 0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#d9c3a3';
    roundRect(ctx, 60, 642, W - 120, 740, 44); ctx.fill();
    ctx.fillStyle = C.paper;
    roundRect(ctx, 60, 630, W - 120, 740, 44); ctx.fill();
    drawGribouille(ctx, W / 2, 760, 0.6, { time: confirm.time });
    const s = confirm.step;
    drawText(ctx, t(s === 1 ? 'opt.erase_q1' : 'opt.erase_q2'), W / 2, 905, W - 220, 54, { color: s === 1 ? C.copperDark : C.red, weight: 900 });
    drawText(ctx, t(s === 1 ? 'opt.erase_t1' : 'opt.erase_t2'), W / 2, 1040, W - 240, 36, { color: C.inkSoft, weight: 700, lineH: 46 });
    confirm.buttons.draw(ctx);
    ctx.restore();
  },

  back() {
    if (confirm) { confirm = null; return true; }
    leave();
    return true;
  },

  pointer(type, x, y) {
    if (confirm) { confirm.buttons.pointer(type, x, y); return; }
    if (type === 'up' && !drag && y >= TABS.y - 20 && y <= TABS.y + TABS.h + 20 && x >= TABS.x && x <= TABS.x + TABS.w) {
      const list = tabs();
      setPage(list[Math.min(list.length - 1, Math.floor((x - TABS.x) / (TABS.w / list.length)))]);
      return;
    }
    if (type === 'down') {
      // curseur : on attrape n'importe où sur la piste (zone large pour le pouce)
      for (const k of Object.keys(SLIDERS).filter((kk) => ROWS[kk])) {
        // 122 px de haut, sans déborder sur l'interrupteur Vibrations juste en dessous
        if (y > sliderY(k) - 66 && y < sliderY(k) + 56 && x > SL.x0 - 60 && x < SL.x1 + 60) {
          drag = k;
          setVol(k, (x - SL.x0) / (SL.x1 - SL.x0));
          vibrate(8);
          return;
        }
      }
    }
    if (drag) {
      if (type === 'move') setVol(drag, (x - SL.x0) / (SL.x1 - SL.x0));
      else if (type === 'up' || type === 'cancel') {
        // aperçu du volume des sons au relâchement
        if (drag === 'sound') sfx('coin');
        drag = null;
        persist();
      }
      return;
    }
    buttons.pointer(type, x, y);
  },
};
