// .bsq — Beatsqare pack: one file with the song audio (mp3 / mp4 / wav / ogg) and every chart for it.
// Layout: "BSQPACK1" (8 bytes) | uint32 LE header length | UTF-8 JSON header | raw audio bytes.
// Header: { format: 'beatsqare-pack', v: 1, title, artist, audio: { name, mime, size }, charts: [chart, …] }
import { idb, uid, pickAudioFile } from './util.js';
import { songKey, renderDemo, songUrl } from './audio.js';

const MAGIC = 'BSQPACK1';

export const isPack = buf => buf.byteLength > 12 && new TextDecoder().decode(new Uint8Array(buf, 0, 8)) === MAGIC;

export function encodePack(header, audio) {
  const hj = new TextEncoder().encode(JSON.stringify({ format: 'beatsqare-pack', v: 1, ...header }));
  const out = new Uint8Array(12 + hj.length + audio.byteLength);
  out.set(new TextEncoder().encode(MAGIC), 0);
  new DataView(out.buffer).setUint32(8, hj.length, true);
  out.set(hj, 12); out.set(new Uint8Array(audio), 12 + hj.length);
  return out;
}

export function decodePack(buf) {
  if (!isPack(buf)) throw new Error('not a .bsq pack');
  const n = new DataView(buf).getUint32(8, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 12, n)));
  if (header.format !== 'beatsqare-pack' || !Array.isArray(header.charts)) throw new Error('bad pack header');
  return { header, audio: buf.slice(12 + n) };
}

async function sha(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Import: audio goes into this browser's cache as a local song; each chart becomes a library chart.
export async function importPack(buf) {
  const { header, audio } = decodePack(buf);
  const song = { source: 'local', ref: 'pack-' + await sha(audio), credit: header.artist || '', license: 'From a .bsq pack', file: header.audio?.name || '', mime: header.audio?.mime || 'audio/mpeg' };
  await idb.putAudio(songKey(song), audio);
  const existing = await idb.charts();
  const made = [];
  for (const [i, c] of header.charts.entries()) {
    if (!Array.isArray(c.notes) || !c.notes.length) continue;
    // re-importing the same pack replaces its charts instead of duplicating them
    const id = existing.find(e => e.song?.ref === song.ref && e.fromPack && e.packIndex === i)?.id || uid();
    const chart = { title: header.title, artist: header.artist, difficulty: 'Normal', level: 5, ...c, id, song, bpmSet: true, fromPack: true, packIndex: i, created: Date.now(), updated: Date.now() };
    delete chart.catalogId;
    await idb.putChart(chart);
    made.push(chart);
  }
  return made;
}

// Export: bundle a song with all library charts that use it.
export async function exportPack(chart) {
  const all = (await idb.charts()).filter(c => songKey(c.song) === songKey(chart.song) && c.notes.length);
  const charts = (all.length ? all : [chart]).map(c => ({ title: c.title, artist: c.artist, difficulty: c.difficulty, level: c.level, bpm: c.bpm, offset: c.offset, timing: c.timing, duration: c.duration, notes: c.notes }));
  if (!all.some(c => c.id === chart.id)) charts.unshift({ title: chart.title, artist: chart.artist, difficulty: chart.difficulty, level: chart.level, bpm: chart.bpm, offset: chart.offset, timing: chart.timing, duration: chart.duration, notes: chart.notes });
  const { bytes, mime, name } = await rawAudio(chart.song, chart.title);
  return encodePack({ title: chart.title, artist: chart.artist || '', audio: { name, mime, size: bytes.byteLength }, charts }, bytes);
}

async function rawAudio(song, title) {
  if (song.source === 'builtin') return { bytes: wav(await renderDemo()), mime: 'audio/wav', name: 'square-one.wav' };
  let bytes = await idb.audio(songKey(song)).catch(() => null);
  if (!bytes && songUrl(song)) { const r = await fetch(songUrl(song)); if (!r.ok) throw new Error('could not download the song'); bytes = await r.arrayBuffer(); }
  if (!bytes) bytes = await (await pickAudioFile(song)).arrayBuffer();
  const mime = song.mime || 'audio/mpeg';
  return { bytes, mime, name: song.file || (title || 'song') + ({ 'audio/wav': '.wav', 'video/mp4': '.mp4', 'audio/mp4': '.m4a', 'audio/ogg': '.ogg' }[mime] || '.mp3') };
}

// 16-bit PCM WAV from an AudioBuffer (used for the synthesized demo track)
function wav(ab) {
  const ch = ab.numberOfChannels, n = ab.length, sr = ab.sampleRate, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const s = (o, t) => { for (let i = 0; i < t.length; i++) out.setUint8(o + i, t.charCodeAt(i)); };
  s(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); s(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
  out.setUint16(22, ch, true); out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  s(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const data = []; for (let c = 0; c < ch; c++) data.push(ab.getChannelData(c));
  for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < ch; c++, o += 2) out.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 0x7fff, true);
  return out.buffer;
}

export function downloadBytes(name, bytes) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/x-beatsqare-pack' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
