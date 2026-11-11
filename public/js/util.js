// Shared helpers: settings, IndexedDB (charts + audio cache), API, toasts, icons.

export const LANES = ['up', 'right', 'down', 'left'];
export const LANE_NAMES = ['Up', 'Right', 'Down', 'Left'];
export const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const COLORS = ['#19f0ff', '#ff2bd6', '#3dff7a', '#ffb020']; // mutated in place by applyTheme
export let BALL = '#fff6a0';                                            // live binding, reassigned by applyTheme
export const THEMES = [
  { name: 'Vector', colors: ['#19f0ff', '#ff2bd6', '#3dff7a', '#ffb020'], ball: '#fff6a0' },
  { name: 'Sunset', colors: ['#ffb03d', '#ff3d7f', '#ff7a3d', '#b45cff'], ball: '#fff1d6' },
  { name: 'Ocean', colors: ['#3dd6ff', '#4d7bff', '#3dffc8', '#9a7bff'], ball: '#e8fbff' },
  { name: 'Phosphor', colors: ['#9dffb4', '#4ee07a', '#c9ffd6', '#2fbf5c'], ball: '#f0fff3' },
  { name: 'Amber', colors: ['#ffc040', '#ff8a00', '#ffe08a', '#ff6a1a'], ball: '#fff4d8' },
  { name: 'Sakura', colors: ['#ff9fd0', '#ff5fa2', '#ffd8ec', '#c78bff'], ball: '#ffffff' },
];
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
  crt: true, shake: true, particles: true, menuMusic: true, uiSounds: true, bgVideo: true, videoDim: 0.55, autoColor: true,
  handle: '',
  theme: null, // { colors: [up, right, down, left], ball }
};
let settings;
try { settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('bsq.settings') || '{}') }; } catch { settings = { ...DEFAULTS }; }
if (!settings.mig18) { settings.bgVideo = true; settings.mig18 = true; } // v1.8: background video defaults on
if (!settings.handle) { settings.handle = 'SQ-' + Math.floor(1000 + Math.random() * 9000); saveSettings(); }
export function getSettings() { return settings; }
export function saveSettings(patch) {
  if (patch) Object.assign(settings, patch);
  try { localStorage.setItem('bsq.settings', JSON.stringify(settings)); } catch {}
  document.body.classList.toggle('no-crt', !settings.crt);
}
export function setLiveBall(c) { BALL = c; } // auto colours change the ball mid-game
export function applyTheme(theme = settings.theme) {
  const t = theme && theme.colors && theme.colors.length === 4 ? theme : THEMES[0];
  t.colors.forEach((c, i) => (COLORS[i] = c));
  BALL = t.ball || THEMES[0].ball;
  const r = document.documentElement.style;
  ['up', 'right', 'down', 'left'].forEach((k, i) => r.setProperty('--' + k, COLORS[i]));
  r.setProperty('--ball', BALL);
}
applyTheme();

// ---------- per-song title / artist overrides (also written into this device's charts)
export function songMeta(key) { try { return JSON.parse(localStorage.getItem('bsq.songMeta') || '{}')[key] || null; } catch { return null; } }
export function setSongMeta(key, meta) {
  try { const all = JSON.parse(localStorage.getItem('bsq.songMeta') || '{}'); all[key] = meta; localStorage.setItem('bsq.songMeta', JSON.stringify(all)); } catch {}
}

// Modal: confirm or edit a song's title and artist (prefilled from the file's tags or name)
export function askSongInfo(info, heading = 'Song info', opts = {}) {
  let art = opts.art || null, artChanged = false;
  const url = () => art ? URL.createObjectURL(new Blob([art.data], { type: art.mime })) : '';
  return new Promise(res => {
    const ov = document.createElement('div');
    ov.className = 'overlay'; ov.style.position = 'fixed'; ov.style.zIndex = 40;
    ov.innerHTML = `<form class="panel frame pad" style="--c:var(--down)">
      <div class="head"><h2 class="sec-title" style="font-size:22px">${esc(heading)}</h2>${info.source ? `<span class="lbl">${esc(info.source)}</span>` : ''}</div>
      <div class="field"><span class="lbl">Title</span><input class="input" name="title" maxlength="80" required value="${esc(info.title || '')}"></div>
      <div class="field" style="margin-top:12px"><span class="lbl">Artist</span><input class="input" name="artist" maxlength="80" value="${esc(info.artist || '')}"></div>
      <div class="field cover-field" style="margin-top:14px"><span class="lbl">Cover image</span>
        <div class="cover-row"><div class="cover-thumb" data-thumb></div>
          <div class="row"><label class="btn sm">Choose image<input type="file" accept="image/*" hidden data-img></label>
          ${opts.fromFile ? '<button class="btn sm" type="button" data-fromfile>From song file</button>' : ''}
          <button class="btn sm" type="button" data-noart>Remove</button></div></div></div>
      ${opts.video !== undefined ? `<div class="field" style="margin-top:14px"><span class="lbl">Background video</span>
        <div class="row"><span class="muted" data-vname style="font-size:12px">${opts.video ? 'Has a video' : 'None'}</span>
          <label class="btn sm">Choose video<input type="file" accept="video/*,.mp4,.webm,.mov" hidden data-vid></label>
          <button class="btn sm" type="button" data-novid>Remove</button></div></div>` : ''}
      <div class="row" style="margin-top:18px"><button class="btn pri" style="--c:var(--down)">Save</button><button class="btn" type="button" data-x>Cancel</button></div></form>`;
    document.body.appendChild(ov);
    const f = ov.querySelector('form'), thumb = ov.querySelector('[data-thumb]');
    const showArt = () => { thumb.style.backgroundImage = art ? `url('${url()}')` : ''; thumb.textContent = art ? '' : 'None'; };
    showArt();
    ov.querySelector('[data-img]').onchange = async e => { const file = e.target.files[0]; if (!file) return; try { art = await squareImage(file); artChanged = true; showArt(); } catch { toast('Couldn’t read that image', true); } };
    ov.querySelector('[data-noart]').onclick = () => { art = null; artChanged = true; showArt(); };
    let video, videoChanged = false;
    const vi = ov.querySelector('[data-vid]'), vn = ov.querySelector('[data-vname]');
    if (vi) vi.onchange = e => { const file = e.target.files[0]; if (!file) return; video = file; videoChanged = true; vn.textContent = file.name + ' · ' + (file.size / 1048576).toFixed(1) + ' MB'; };
    const nv = ov.querySelector('[data-novid]'); if (nv) nv.onclick = () => { video = null; videoChanged = true; vn.textContent = 'None'; };
    const ff = ov.querySelector('[data-fromfile]');
    if (ff) ff.onclick = async () => { const pic = await opts.fromFile(); if (!pic) return toast('That song file has no cover image', true); art = await squareImage(new Blob([pic.data], { type: pic.mime })); artChanged = true; showArt(); };
    f.title.focus(); f.title.select();
    f.onsubmit = e => { e.preventDefault(); ov.remove(); res({ title: f.title.value.trim() || 'Untitled', artist: f.artist.value.trim(), ...(artChanged || opts.art ? { art } : {}), ...(videoChanged ? { video } : {}) }); };
    ov.querySelector('[data-x]').onclick = () => { ov.remove(); res(null); };
  });
}

// Title / artist from an mp3's ID3v2 tag (v2.3 / v2.4: TIT2, TPE1), or null
export function readTags(buf) {
  try {
    const b = new Uint8Array(buf);
    if (b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return null;
    const ver = b[3], size = (b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9];
    const out = {};
    let p = 10;
    if (b[5] & 0x40) p += ver === 4 ? ((b[10] << 21) | (b[11] << 14) | (b[12] << 7) | b[13]) : (((b[10] << 24) | (b[11] << 16) | (b[12] << 8) | b[13]) + 4);
    const text = (a, e) => {
      const enc = b[a], body = b.subarray(a + 1, e);
      const dec = enc === 0 ? new TextDecoder('latin1') : enc === 1 ? new TextDecoder('utf-16') : enc === 2 ? new TextDecoder('utf-16be') : new TextDecoder('utf-8');
      return dec.decode(body).replace(/\u0000+$/g, '').split('\u0000')[0].trim();
    };
    while (p + 10 < 10 + size && p + 10 < b.length) {
      const id = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const len = ver === 4 ? ((b[p + 4] << 21) | (b[p + 5] << 14) | (b[p + 6] << 7) | b[p + 7]) : ((b[p + 4] << 24) | (b[p + 5] << 16) | (b[p + 6] << 8) | b[p + 7]);
      if (id === 'TIT2') out.title = text(p + 10, p + 10 + len);
      if (id === 'TPE1') out.artist = text(p + 10, p + 10 + len);
      if (id === 'APIC' && !out.picture) {
        const s0 = p + 10, enc = b[s0]; let q = s0 + 1;
        let mime = ''; while (q < s0 + len && b[q]) mime += String.fromCharCode(b[q++]);
        q += 2; // null + picture type
        if (enc === 1 || enc === 2) { while (q + 1 < s0 + len && (b[q] || b[q + 1])) q += 2; q += 2; } else { while (q < s0 + len && b[q]) q++; q++; }
        const data = b.slice(q, s0 + len);
        if (data.length > 100) out.picture = { mime: /png/i.test(mime) ? 'image/png' : 'image/jpeg', data: data.buffer };
      }
      p += 10 + len;
    }
    return out.title || out.artist || out.picture ? out : null;
  } catch { return null; }
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
  delAudio: k => tx('audio', 'readwrite', s => s.delete(k)),
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

// Strip video-upload clutter from titles: (Official Video), 【MV】, （Lyric Video）, 【… MAD】, (TV anime … OP), etc.
// A leading 【Artist】 or "Artist「Title」" fills in a missing artist.
export function tidySongInfo({ title = '', artist = '' }) {
  const junk = /official|video|lyric|\bmv\b|\bpv\b|audio|\bmad\b|\bhd\b|\b4k\b|full ver|主題歌|アニメ|\bop\b|\bed\b|visualizer|remaster|kbps|\bncs\b|copyright free/i;
  const OPEN = '【[(（「『', CLOSE = '】])）」』';
  const strip = s => { // drop bracket groups (nesting-aware) whose text is upload clutter
    s = String(s || ''); let out = '';
    for (let i = 0; i < s.length; i++) {
      if (OPEN.includes(s[i])) {
        let d = 0, j = i;
        for (; j < s.length; j++) { if (OPEN.includes(s[j])) d++; else if (CLOSE.includes(s[j]) && --d === 0) break; }
        if (j < s.length && junk.test(s.slice(i + 1, j))) { out += ' '; i = j; continue; }
      }
      out += s[i];
    }
    return out.replace(/\s+/g, ' ').trim();
  };
  let t = strip(title), a = strip(artist);
  const lead = t.match(/^【([^】]+)】\s*(.+)$/);
  if (lead) { if (!a) a = lead[1].trim(); t = lead[2].trim(); }
  a = a.replace(/^【[^】]*】\s*/, '').trim();
  const kagi = t.match(/^(.+?)\s*[「『]\s*(.+?)\s*[」』]\s*$/);
  if (kagi) { if (!a) a = kagi[1].trim(); t = kagi[2].trim(); }
  return { title: t || String(title).trim(), artist: a };
}

// ---------- cover art (per song, stored next to the audio cache as 'art:<songKey>')
const artUrls = new Map();
export async function artUrl(key) {
  if (artUrls.has(key)) return artUrls.get(key);
  const a = await idb.audio('art:' + key).catch(() => null);
  const u = a && a.data ? URL.createObjectURL(new Blob([a.data], { type: a.mime || 'image/jpeg' })) : null;
  artUrls.set(key, u);
  return u;
}
export const getArt = key => idb.audio('art:' + key).catch(() => null);
export async function setArt(key, art) {
  const old = artUrls.get(key); if (old) URL.revokeObjectURL(old);
  artUrls.delete(key);
  if (art && art.data) await idb.putAudio('art:' + key, { mime: art.mime || 'image/jpeg', data: art.data });
  else await idb.delAudio('art:' + key);
}
// centre-crop to a square and scale to at most 600 px, as JPEG
export async function squareImage(blob) {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(bmp.width, bmp.height), out = Math.min(600, s);
  const c = document.createElement('canvas'); c.width = c.height = out;
  c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, out, out);
  const jpg = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.88));
  return { mime: 'image/jpeg', data: await jpg.arrayBuffer() };
}

// ---------- background videos (per song, 'video:<songKey>' → Blob)
export const getVideo = key => idb.audio('video:' + key).catch(() => null);
export async function setVideo(key, blob) { if (blob) await idb.putAudio('video:' + key, blob); else await idb.delAudio('video:' + key); }
export const hasVideo = async key => !!(await getVideo(key));

// Packs imported by v1.6 (before video support) stored "cover + video" as one image. Split the video back out.
export async function repairStuckVideo(key) {
  if (await getVideo(key)) return false;
  const art = await getArt(key);
  if (!art || !art.data || art.data.byteLength < 1500000) return false;
  const b = new Uint8Array(art.data), lim = Math.min(b.length - 8, 4000000);
  for (let i = 104; i < lim; i++) {
    if (b[i] === 0x66 && b[i + 1] === 0x74 && b[i + 2] === 0x79 && b[i + 3] === 0x70) { // 'ftyp' = start of an mp4
      const start = i - 4;
      await setVideo(key, new Blob([art.data.slice(start)], { type: 'video/mp4' }));
      await setArt(key, { mime: art.mime || 'image/jpeg', data: art.data.slice(0, start) });
      return true;
    }
  }
  return false;
}
