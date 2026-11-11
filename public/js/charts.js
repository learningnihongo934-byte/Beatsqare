// Built-in charts for the synthesized demo song, plus helpers to create / import charts.
import { DEMO, sectionOf } from './audio.js';
import { idb, uid, DIFFS } from './util.js';

const LEAD = [69, 72, 74, 76, 74, 72, 69, 67, 69, 72, 76, 79, 76, 74, 72, 74];
const pitchLane = (m, prev) => m >= 76 ? 0 : m <= 67 ? 2 : (prev === 1 ? 3 : 1);

export function demoChart(diff) {
  const b = 60 / DEMO.bpm, notes = [];
  const lvl = DIFFS.indexOf(diff); // 0 easy .. 2 hard
  let holdUntil = -1, cyc = 0, prev = 0;
  const add = (t, lane, extra = {}) => { if (t < holdUntil - 1e-3 && !extra.duringHold) return; delete extra.duringHold; notes.push({ t: +t.toFixed(4), lane, ...extra }); prev = lane; };
  const ring = [0, 1, 2, 3, 2, 1, 0, 3];
  for (let bar = 0; bar < DEMO.bars; bar++) {
    const sec = sectionOf(bar), T = bar * 4 * b;
    if (sec === 'intro') {
      if (bar < 2 - lvl) continue;
      for (let q = 0; q < 4; q++) if (lvl > 0 || q % 2 === 0) add(T + q * b, ring[cyc++ % 8]);
      if (lvl === 2 && bar === 3) add(T + 3.5 * b, 1);
    } else if (sec === 'A') {
      for (let s = 0; s < 8; s++) {
        const plays = (s + bar) % 3 !== 2, m = LEAD[(bar % 2) * 8 + s];
        if (lvl === 0 && (s % 4 !== 0)) continue;
        if (lvl === 1 && (s % 2 !== 0) && !(plays && s % 4 === 3)) continue;
        if (lvl === 2 && !plays && s % 2) continue;
        add(T + s * b / 2, pitchLane(m, prev));
      }
    } else if (sec === 'B') {
      const lane = ring[bar % 8];
      if (lvl === 0) { add(T, lane, { len: 2 * b }); holdUntil = T + 2 * b; add(T + 2.5 * b, (lane + 2) % 4); continue; }
      add(T, lane); add(T, (lane + 1) % 4); // chord on the downbeat
      if (bar % 2 === 0) { add(T + b, (lane + 2) % 4); add(T + 2 * b, (lane + 3) % 4, { len: 1.5 * b }); holdUntil = T + 3.5 * b; if (lvl === 2) add(T + 3 * b, (lane + 2) % 4, { duringHold: true }); }
      else { for (let q = 1; q < 4; q++) add(T + q * b, ring[(bar + q) % 8]); if (lvl === 2) { add(T + 1.5 * b, (lane + 3) % 4); add(T + 3.5 * b, (lane + 1) % 4); } }
    } else if (sec === 'break') {
      const lane = [0, 2, 1, 3][bar % 4];
      add(T, lane, { len: (lvl === 0 ? 3 : 2) * b }); holdUntil = T + (lvl === 0 ? 3 : 2) * b;
      if (lvl === 2) { add(T + b, (lane + 1) % 4, { duringHold: true }); }
      if (lvl >= 1) add(T + 3 * b, (lane + 2) % 4, lvl === 2 ? { type: 'pierce' } : {});
      if (lvl === 2) add(T + 2.5 * b, (lane + 3) % 4);
    } else { // drop
      for (let s = 0; s < 8; s++) {
        const t = T + s * b / 2, m = LEAD[(bar % 2) * 8 + s] + 12, plays = (s + bar) % 3 !== 2;
        if (lvl === 0 && s % 2) continue;
        if (lvl === 1 && s % 2 && !plays) continue;
        if (s === 0 && lvl >= 1) { const l = ring[bar % 8]; add(t, l); add(t, (l + 3) % 4); continue; }
        if (lvl === 2 && s === 7 && bar % 2) { add(t, OPPOSITE(prev), { type: 'pierce' }); continue; }
        add(t, pitchLane(m - 12, prev));
      }
    }
  }
  return {
    id: 'demo-' + diff.toLowerCase(), builtin: true, bpmSet: true,
    title: DEMO.title, artist: DEMO.artist, difficulty: diff, level: [2, 5, 8][lvl],
    bpm: DEMO.bpm, offset: 0, duration: DEMO.bars * 4 * b + 2,
    song: { source: 'builtin', ref: 'square-one', license: 'Original, made for Beatsqare', credit: DEMO.artist },
    notes,
  };
}
const OPPOSITE = l => (l + 2) % 4;
export const DEMO_CHARTS = ['Easy', 'Normal', 'Hard'].map(demoChart);

export async function newChart(song, meta = {}) {
  const c = {
    id: uid(), title: meta.title || 'Untitled', artist: meta.artist || '', difficulty: 'Normal', level: 5,
    bpm: meta.bpm || 120, offset: 0, duration: meta.duration || 0, song, notes: [], created: Date.now(), updated: Date.now(),
    bpmSet: song.source === 'builtin',
  };
  if (song.source === 'builtin') { c.bpm = DEMO.bpm; c.title = DEMO.title + ' (my chart)'; c.artist = DEMO.artist; }
  await idb.putChart(c);
  return c;
}

export async function saveCatalogChart(c) {
  // a downloaded catalog chart lives in the library under its catalog id
  const local = { ...c, id: 'cat-' + c.catalogId, bpmSet: true, downloaded: Date.now() };
  await idb.putChart(local);
  return local;
}

export async function importChartFile(file) {
  const d = JSON.parse(await file.text());
  if (!Array.isArray(d.notes) || !d.song) throw new Error('not a Beatsqare chart');
  const c = { ...d, id: uid(), bpmSet: true, created: Date.now(), updated: Date.now() };
  delete c.format; delete c.catalogId;
  await idb.putChart(c);
  return c;
}
