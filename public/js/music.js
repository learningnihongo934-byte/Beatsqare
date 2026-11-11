// Menu music: one channel shared by the home screen (random owned song) and song-select previews.
// Routed through the song bus so the background visualiser reacts, and exposes the beat for the rings.
import { ctx, ac, loadSong, songInput, songKey } from './audio.js';
import { idb, getSettings, saveSettings } from './util.js';
import { DEMO_CHARTS } from './charts.js';

let cur = null, token = 0;
const listeners = new Set();
export const onMusic = fn => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach(f => f(cur && cur.info));
export const nowPlaying = () => cur && cur.info;

// Songs whose audio is on this device (plus the built-in track), one entry per song.
export async function ownedSongs() {
  const charts = [...DEMO_CHARTS, ...(await idb.charts().catch(() => []))];
  const seen = new Map();
  for (const c of charts) {
    const k = songKey(c.song);
    if (seen.has(k)) continue;
    seen.set(k, { key: k, song: c.song, title: c.title.replace(/ \((edit|my chart|auto)\)$/, ''), artist: c.artist || c.song.credit || '', bpm: c.bpm, offset: c.offset || 0 });
  }
  const out = [];
  for (const s of seen.values()) if (s.song.source === 'builtin' || await idb.audio(s.key).catch(() => null)) out.push(s);
  return out;
}

function fade(c, sec) {
  if (!c || !ac) return;
  const t = ac.currentTime;
  c.gain.gain.cancelScheduledValues(t); c.gain.gain.setValueAtTime(c.gain.gain.value, t);
  c.gain.gain.linearRampToValueAtTime(0, t + sec);
  try { c.src.stop(t + sec + 0.05); } catch {}
}
export function stopMusic(sec = 0.4) { token++; fade(cur, sec); cur = null; emit(); }

async function start(info, at, onEnd) {
  const my = ++token;
  ctx();
  let buf; try { buf = await loadSong(info.song); } catch { return false; }
  if (my !== token) return false;
  fade(cur, 0.6);
  const src = ac.createBufferSource(), gain = ac.createGain();
  src.buffer = buf; src.connect(gain).connect(songInput());
  const t = ac.currentTime + 0.05, pos = Math.max(0, Math.min(buf.duration - 5, at(buf.duration)));
  gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.8, t + 1.6);
  src.start(t, pos);
  const c = { src, gain, startCtx: t, startPos: pos, info: { ...info, duration: buf.duration } };
  src.onended = () => { if (cur === c) { cur = null; emit(); onEnd && onEnd(); } };
  cur = c; emit();
  return true;
}

// Home screen: a random owned song from around its first chorus; another one when it ends.
let lastKey = null;
export async function playRandom() {
  if (!getSettings().menuMusic) return;
  const songs = await ownedSongs();
  const pool = songs.length > 1 ? songs.filter(s => s.key !== lastKey) : songs;
  if (!pool.length) return;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  lastKey = pick.key;
  await start(pick, d => d * (0.25 + Math.random() * 0.15), () => playRandom());
}
export function skip() { stopMusic(0.3); setTimeout(playRandom, 320); }
export function toggleMute() {
  const on = !getSettings().menuMusic;
  saveSettings({ menuMusic: on });
  if (on) playRandom(); else stopMusic(0.5);
  return on;
}

// Song select: preview of the highlighted song (only if its audio is already here).
export async function preview(info) {
  if (cur && cur.info.key === info.key) return;
  const my = ++token;
  await new Promise(r => setTimeout(r, 300));
  if (my !== token) return;
  const have = info.song.source === 'builtin' || await idb.audio(info.key).catch(() => null);
  if (my !== token) return;
  if (!have) { fade(cur, 0.5); cur = null; emit(); return; }
  token--; // let start() claim this slot
  await start(info, d => d * 0.35, null);
}

export const musicPos = () => (cur && ac ? ac.currentTime - cur.startCtx + cur.startPos : 0);

// Beat clock of what's playing, for the background rings: beats since the first beat, or null.
export function beatPos() {
  if (!cur || !cur.info.bpm || !ac) return null;
  const pos = ac.currentTime - cur.startCtx + cur.startPos;
  return (pos - (cur.info.offset || 0)) / (60 / cur.info.bpm);
}
