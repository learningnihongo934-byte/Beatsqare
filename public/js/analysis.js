// Audio analysis: waveform peaks, 3-band spectral flux, BPM + phase detection, and auto-charting.

const NFFT = 1024, HOP = 256;
const yieldUI = () => new Promise(r => setTimeout(r, 0));

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

// mono, downsampled to ~22 kHz
function monoOf(buffer) {
  const ch = buffer.numberOfChannels, n = buffer.length, f = buffer.sampleRate >= 32000 ? 2 : 1;
  const out = new Float32Array(Math.floor(n / f));
  const chans = []; for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c));
  for (let i = 0, o = 0; o < out.length; o++, i += f) {
    let s = 0; for (const d of chans) { s += d[i]; if (f === 2) s += d[i + 1]; }
    out[o] = s / (ch * f);
  }
  return { data: out, sr: buffer.sampleRate / f };
}

export function peaksOf(buffer, rate = 200) {
  const d = buffer.getChannelData(0), d2 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : d;
  const step = buffer.sampleRate / rate, n = Math.ceil(buffer.length / step);
  const mn = new Float32Array(n), mx = new Float32Array(n);
  for (let b = 0; b < n; b++) {
    let lo = 1, hi = -1;
    const a = Math.floor(b * step), e = Math.min(buffer.length, Math.floor((b + 1) * step));
    for (let i = a; i < e; i += 2) { const v = (d[i] + d2[i]) * 0.5; if (v < lo) lo = v; if (v > hi) hi = v; }
    mn[b] = lo > hi ? 0 : lo; mx[b] = lo > hi ? 0 : hi;
  }
  return { rate, min: mn, max: mx };
}

export async function analyze(buffer, onProgress) {
  const { data, sr } = monoOf(buffer);
  const frames = Math.max(1, Math.floor((data.length - NFFT) / HOP));
  const fr = sr / HOP;
  const win = new Float32Array(NFFT); for (let i = 0; i < NFFT; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / NFFT);
  const binHz = sr / NFFT;
  const b1 = Math.max(2, Math.round(170 / binHz)), b2 = Math.round(2000 / binHz), b3 = Math.min(NFFT / 2, Math.round(11000 / binHz));
  const low = new Float32Array(frames), mid = new Float32Array(frames), high = new Float32Array(frames), rms = new Float32Array(frames);
  const re = new Float32Array(NFFT), im = new Float32Array(NFFT);
  let prev = new Float32Array(NFFT / 2), cur = new Float32Array(NFFT / 2);
  for (let f = 0; f < frames; f++) {
    const o = f * HOP; let e = 0;
    for (let i = 0; i < NFFT; i++) { const v = data[o + i]; re[i] = v * win[i]; im[i] = 0; e += v * v; }
    rms[f] = Math.sqrt(e / NFFT);
    fft(re, im);
    let l = 0, m = 0, h = 0;
    for (let k = 1; k < b3; k++) {
      const mag = Math.log1p(100 * Math.hypot(re[k], im[k]));
      cur[k] = mag;
      const d = mag - prev[k];
      if (d > 0) { if (k < b1) l += d; else if (k < b2) m += d; else h += d; }
    }
    low[f] = l / b1; mid[f] = m / (b2 - b1); high[f] = h / (b3 - b2);
    const t = prev; prev = cur; cur = t;
    if ((f & 1023) === 1023) { onProgress && onProgress(f / frames); await yieldUI(); }
  }
  const norm = a => { let mx = 1e-9; for (const v of a) if (v > mx) mx = v; for (let i = 0; i < a.length; i++) a[i] /= mx; return a; };
  norm(low); norm(mid); norm(high);
  const flux = new Float32Array(frames);
  for (let i = 0; i < frames; i++) flux[i] = low[i] * 1.2 + mid[i] + high[i] * 0.8;
  norm(flux);
  const t0 = NFFT / 2 / sr; // frame i's centre is at t0 + i / fr
  return { fr, t0, flux, low, mid, high, rms: norm(rms), duration: buffer.duration };
}

// Interpolated envelope value at time t
const envAt = (env, fr, t0, t) => {
  const x = (t - t0) * fr, i = Math.floor(x);
  if (i < 0 || i + 1 >= env.length) return 0;
  return env[i] + (env[i + 1] - env[i]) * (x - i);
};

export function detectBpm(A) {
  const { flux, fr, t0 } = A, n = flux.length;
  // high-pass the envelope (remove local mean) so autocorrelation sees pulses, not loudness
  const w = Math.round(fr * 0.25), env = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += flux[i]; if (i >= 2 * w) acc -= flux[i - 2 * w];
    const mean = acc / Math.min(i + 1, 2 * w);
    env[Math.max(0, i - w)] = Math.max(0, flux[Math.max(0, i - w)] - mean);
  }
  // Comb search over 70–200 BPM: mean onset strength on the beats plus half the strength on the half-beats.
  // The half-beat term picks the tempo whose 8ths also land on the song's event grid (fixes 80 vs 120, 106 vs 160 confusions).
  const mean = (per, ph) => { let s = 0, h = 0, k = 0; for (let t = ph; t < A.duration; t += per) { s += envAt(env, fr, t0, t); h += envAt(env, fr, t0, t + per / 2); k++; } return (s + 0.5 * h) / Math.max(1, k); };
  let top = -1, topBpm = 120, topPhase = 0;
  for (let cand = 70; cand <= 200; cand += 0.1) {
    const per = 60 / cand;
    for (let ph = 0; ph < per; ph += per / 32) { const s = mean(per, ph); if (s > top) { top = s; topBpm = cand; topPhase = ph; } }
  }
  const coarse = topBpm; top = -1;
  for (let cand = coarse - 0.15; cand <= coarse + 0.15; cand += 0.005) {
    const per = 60 / cand;
    for (let ph = 0; ph < per; ph += per / 96) { const s = mean(per, ph); if (s > top) { top = s; topBpm = cand; topPhase = ph; } }
  }
  while (topBpm < 95) topBpm *= 2; // half-time reads double up; the phase stays on a beat
  const r = Math.round(topBpm);
  if (Math.abs(topBpm - r) < 0.08) topBpm = r;
  else topBpm = Math.round(topBpm * 100) / 100;
  // re-solve phase for the final tempo on kick + snare (low + mid bands), so beats land on the drums, not offbeat hats
  const per = 60 / topBpm; let pb = -1;
  const drum = new Float32Array(n); for (let i = 0; i < n; i++) drum[i] = (A.low ? A.low[i] + 0.7 * A.mid[i] : env[i]);
  for (let ph = 0; ph < per; ph += per / 192) {
    let s = 0; for (let t = ph; t < A.duration; t += per) s += envAt(drum, fr, t0, t);
    if (s > pb) { pb = s; topPhase = ph; }
  }
  return { bpm: topBpm, offset: +topPhase.toFixed(4) };
}

// ---------- auto-chart
const CFG = {
  Easy: { div: 1, nps: 1.4, gap: 1, chord: 0, pierce: 0, hold: 2 },
  Normal: { div: 2, nps: 2.6, gap: 0.5, chord: 0.04, pierce: 0, hold: 1.5 },
  Hard: { div: 4, nps: 4.2, gap: 0.25, chord: 0.07, pierce: 0.03, hold: 1.5 },
  Expert: { div: 4, nps: 6.5, gap: 0.25, chord: 0.1, pierce: 0.06, hold: 1 },
};
export function autoChart(A, bpm, offset, difficulty = 'Normal', seed = 7) {
  const cfg = CFG[difficulty] || CFG.Normal, beat = 60 / bpm, slot = beat / cfg.div;
  const { flux, fr, t0, low, mid, high, rms } = A, n = flux.length;
  let rs = seed; const rnd = () => ((rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296);
  // 1) peak-pick onsets with an adaptive threshold — on the full flux and per band (catches vocals / hats in dense mixes)
  const W = Math.round(fr * 0.5), on = [];
  const prefix = a => { const p = new Float32Array(n + 1); let s = 0; for (let i = 0; i < n; i++) p[i + 1] = (s += a[i]); return p; };
  const P = { all: prefix(flux), low: prefix(low), mid: prefix(mid), high: prefix(high) };
  const localMean = (k, i) => { const a = Math.max(0, i - W), b = Math.min(n, i + W); return (P[k][b] - P[k][a]) / (b - a); };
  const peaks = (arr, k, mul, add, weight) => {
    for (let i = 3; i < n - 3; i++) {
      const v = arr[i];
      if (v < arr[i - 1] || v < arr[i + 1] || v < arr[i - 2] || v < arr[i + 2] || v < arr[i - 3] || v < arr[i + 3]) continue;
      const mean = localMean(k, i);
      if (v > mean * mul + add) on.push({ i, t: t0 + i / fr, s: (v - mean) * weight });
    }
  };
  peaks(flux, 'all', 1.3, 0.03, 1);
  if (difficulty !== 'Easy') { peaks(mid, 'mid', 1.5, 0.03, 0.8); peaks(low, 'low', 1.6, 0.04, 0.8); }
  if (difficulty === 'Hard' || difficulty === 'Expert') peaks(high, 'high', 1.6, 0.03, 0.6);
  // relative novelty of each band at frame i (band vs its own local level) decides the lane
  const rel = i => [low[i] / (localMean('low', i) + 0.02), mid[i] / (localMean('mid', i) + 0.02), high[i] / (localMean('high', i) + 0.02)];
  // 2) quantise to the grid, keep the strongest onset per slot
  const slots = new Map();
  for (const o of on) {
    const k = Math.round((o.t - offset) / slot);
    if (k < 0) continue;
    const prevO = slots.get(k);
    if (!prevO || prevO.s < o.s) slots.set(k, o);
  }
  let picks = [...slots.entries()].map(([k, o]) => {
    const t = offset + k * slot, onBeat = Math.abs((k / cfg.div) - Math.round(k / cfg.div)) < 1e-6;
    return { k, t, o, s: o.s * (onBeat ? 1.25 : 1) + (k % (cfg.div * 4) === 0 ? 0.15 : 0) };
  }).filter(p => p.t > 0.4 && p.t < A.duration - 0.3);
  // 3) density cap: keep the strongest N, then enforce minimum gap
  const target = Math.round(A.duration * cfg.nps);
  picks.sort((a, b) => b.s - a.s); picks = picks.slice(0, target); picks.sort((a, b) => a.t - b.t);
  const minGap = cfg.gap * beat - 1e-3, kept = [];
  for (const p of picks) if (!kept.length || p.t - kept[kept.length - 1].t >= minGap) kept.push(p);
  // 4) lanes from the dominant band, holds on sustained notes, chords on accents, pierce sprinkle
  const strengths = kept.map(p => p.s).sort((a, b) => b - a);
  const chordCut = strengths[Math.floor(strengths.length * cfg.chord)] ?? Infinity;
  const notes = []; let last = -1, repeat = 0, alt = 0, holdEnd = -1;
  for (let j = 0; j < kept.length; j++) {
    const p = kept[j], i = p.o.i;
    if (p.t < holdEnd + beat * 0.25) continue;
    const [L, M, H] = rel(i);
    let lane = L >= M && L >= H ? 2 : H >= M && H > L ? 0 : (alt++ % 2 ? 1 : 3);
    if (lane === last && ++repeat >= (difficulty === 'Easy' ? 3 : 2)) { lane = (lane + 1 + Math.floor(rnd() * 3)) % 4; repeat = 0; }
    else if (lane !== last) repeat = 0;
    const prevT = j ? kept[j - 1].t : -1;
    if (difficulty !== 'Expert' && last >= 0 && lane === (last + 2) % 4 && p.t - prevT < beat / 2 - 1e-3) lane = (last + (alt++ % 2 ? 1 : 3)) % 4;
    const next = kept[j + 1], gap = next ? next.t - p.t : beat * 4;
    const note = { t: +p.t.toFixed(4), lane };
    // sustain = rms between here and the next onset stays near the onset's level
    if (gap >= cfg.hold * beat) {
      const e = Math.min(n - 1, Math.floor((p.t + gap * 0.8 - t0) * fr));
      let s = 0, c = 0; for (let x = i + 2; x < e; x++) { s += rms[x]; c++; }
      if (c && s / c > rms[i] * 0.62) {
        const len = Math.max(beat / cfg.div, Math.floor((gap - beat * 0.5) / (beat / 2)) * (beat / 2));
        if (len >= beat * 0.5) { note.len = +len.toFixed(4); holdEnd = p.t + len; }
      }
    }
    notes.push(note);
    if (!note.len && p.s >= chordCut && cfg.chord) notes.push({ t: note.t, lane: (lane + (rnd() < 0.5 ? 1 : 3)) % 4 });
    else if (!note.len && cfg.pierce && rnd() < cfg.pierce && j > 0 && p.t - kept[j - 1].t >= beat * 0.5) note.type = 'pierce';
    last = lane;
  }
  return notes;
}
