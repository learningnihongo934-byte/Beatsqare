// Shared helpers: settings, IndexedDB (charts + audio cache), API, toasts, icons.

export const LANES = ['up', 'right', 'down', 'left'];
export const LANE_NAMES = ['Up', 'Right', 'Down', 'Left'];
export const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const COLORS = ['#19f0ff', '#ff2bd6', '#3dff7a', '#ffb020'];
export const BALL = '#fff6a0';
export const BAD = '#ff3b5c';
export const OPP = [2, 3, 0, 1];
export const adjacent = (a, b) => a !== b && OPP[a] !== b;
export const DIFFS = ['Easy', 'Normal', 'Hard', 'Expert'];

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const fmtTime = s => { s = Math.max(0, s || 0); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
export const fmtNum = n => (n | 0).toLocaleString('en-US');
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ---------- settings (per device)
const DEFAULTS = {
  audioOffset: 0,      // ms; positive = your taps land late, so we subtract
  visualOffset: 0,     // ms; positive = draw notes later
  speed: 5,            // 1..10 → approach time
  volume: 0.85, hitVolume: 0.5, hitsounds: true,
  crt: true, shake: true, particles: true, menuMusic: true,
  handle: '',
};
let settings;
try { settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('bsq.settings') || '{}') }; } catch { settings = { ...DEFAULTS }; }
if (!settings.handle) { settings.handle = 'SQ-' + Math.floor(1000 + Math.random() * 9000); saveSettings(); }
export function getSettings() { return settings; }
export function saveSettings(patch) {
  if (patch) Object.assign(settings, patch);
  try { localStorage.setItem('bsq.settings', JSON.stringify(settings)); } catch {}
  document.body.classList.toggle('no-crt', !settings.crt);
}
export const approachTime = (speed = settings.speed) => 2.3 - speed * 0.18; // speed 5 → 1.4 s (prototype feel)

// ---------- best scores (per chart key)
export function getBest(key) { try { return JSON.parse(localStorage.getItem('bsq.best.' + key) || 'null'); } catch { return null; } }
export function setBest(key, r) {
  const old = getBest(key);
  if (old && old.score >= r.score) { if (r.fc && !old.fc) { old.fc = true; localStorage.setItem('bsq.best.' + key, JSON.stringify(old)); } return false; }
  try { localStorage.setItem('bsq.best.' + key, JSON.stringify({ score: r.score, acc: r.acc, grade: r.grade, fc: r.fc || (old && old.fc), combo: r.maxCombo, at: Date.now() })); } catch {}
  return true;
}

// ---------- IndexedDB
let dbp;
function db() {
  return dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('beatsqare', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('charts', { keyPath: 'id' }); r.result.createObjectStore('audio'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode), s = t.objectStore(store), out = fn(s);
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
}
export const idb = {
  charts: () => tx('charts', 'readonly', s => s.getAll()),
  chart: id => tx('charts', 'readonly', s => s.get(id)),
  putChart: c => tx('charts', 'readwrite', s => s.put(c)),
  delChart: id => tx('charts', 'readwrite', s => s.delete(id)),
  audio: k => tx('audio', 'readonly', s => s.get(k)),
  putAudio: (k, buf) => tx('audio', 'readwrite', s => s.put(buf, k)),
};

// ---------- API
export async function api(path, opts = {}) {
  const r = await fetch('/api' + path, {
    ...opts,
    headers: opts.body && typeof opts.body === 'string' ? { 'content-type': 'application/json', ...(opts.headers || {}) } : opts.headers,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
  return data;
}
export function uploadFile(file, onProgress) {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest();
    x.open('POST', '/api/upload');
    x.setRequestHeader('content-type', file.type || 'audio/mpeg');
    x.setRequestHeader('x-file-name', encodeURIComponent(file.name));
    x.setRequestHeader('x-handle', settings.handle);
    x.upload.onprogress = e => e.lengthComputable && onProgress && onProgress(e.loaded / e.total);
    x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch {} x.status < 300 ? res(d) : rej(new Error(d.error || 'upload failed')); };
    x.onerror = () => rej(new Error('network error'));
    x.send(file);
  });
}

// ---------- toast
let toastT;
export function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'on' + (bad ? ' bad' : '');
  clearTimeout(toastT); toastT = setTimeout(() => (t.className = ''), 2600);
}

// ---------- icons (inline SVG, stroke = currentColor)
const P = {
  play: '<path d="M5 3l9 5-9 5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" stroke="none"/>',
  heart: '<path d="M8 13.5S2 9.8 2 5.8A3 3 0 0 1 8 4.6a3 3 0 0 1 6 1.2c0 4-6 7.7-6 7.7z"/>',
  edit: '<path d="M2 14l1-4 8-8 3 3-8 8zM9.5 3.5l3 3"/>',
  up: '<path d="M8 13V3M3.5 7.5L8 3l4.5 4.5"/>',
  down: '<path d="M8 3v10M3.5 8.5L8 13l4.5-4.5"/>',
  search: '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>',
  undo: '<path d="M5 3L2 6l3 3M2 6h7a4 4 0 0 1 0 8H6"/>',
  redo: '<path d="M11 3l3 3-3 3M14 6H7a4 4 0 0 0 0 8h3"/>',
  wand: '<path d="M2 14L11 5M10 2v2M13 3l-1 1M14 6h-2M8 3l1 1"/>',
  flag: '<path d="M3 14V2h9l-2 3 2 3H3"/>',
  x: '<path d="M3 3l10 10M13 3L3 13"/>',
  link: '<path d="M7 9a3 3 0 0 0 4 0l2-2a3 3 0 0 0-4-4l-1 1M9 7a3 3 0 0 0-4 0L3 9a3 3 0 0 0 4 4l1-1"/>',
  file: '<path d="M4 1h5l3 3v11H4zM9 1v3h3"/>',
  gear: '<circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3"/>',
  menu: '<path d="M2 4h12M2 8h12M2 12h12"/>',
};
export const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true">${P[n] || ''}</svg>`;

export function downloadText(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export const slug = s => String(s || 'chart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'chart';

// Ask for the audio file of a chart whose song only lives on the player's device (charts of your own files).
export function pickAudioFile(song) {
  return new Promise((res, rej) => {
    const ov = document.createElement('div');
    ov.className = 'overlay'; ov.style.position = 'fixed'; ov.style.zIndex = 40;
    ov.innerHTML = `<div class="panel frame pad" style="--c:var(--down)">
      <div class="head"><h2 class="sec-title" style="font-size:22px">Pick the song file</h2></div>
      <p>This chart uses a song that stays on your device${song.file ? `: <b>${esc(song.file)}</b>` : ''}. Choose it once and it's kept in this browser. Nothing is uploaded.</p>
      <div class="row" style="margin-top:16px"><label class="btn pri" style="--c:var(--down)">Choose audio file<input type="file" accept="audio/*,.mp3,.ogg,.wav,.m4a" hidden></label><button class="btn" data-x>Cancel</button></div></div>`;
    document.body.appendChild(ov);
    ov.querySelector('input').onchange = e => { const f = e.target.files[0]; if (f) { ov.remove(); res(f); } };
    ov.querySelector('[data-x]').onclick = () => { ov.remove(); rej(new Error('No song file picked.')); };
  });
}
