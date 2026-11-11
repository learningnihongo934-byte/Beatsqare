// Web Audio: one context, a song clock locked to the output, song loading with an IndexedDB cache,
// hit sounds, and the built-in synthesized demo track (so the game ships with no audio files).
import { getSettings, idb, pickAudioFile } from './util.js';

export let ac = null;
let master, songGain, sfxGain, analyser, freqData;

export function ctx() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    master = ac.createGain(); master.connect(ac.destination);
    songGain = ac.createGain(); sfxGain = ac.createGain();
    analyser = ac.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.6;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    songGain.connect(analyser); analyser.connect(master); sfxGain.connect(master);
    applyVolume();
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
export function applyVolume() {
  if (!ac) return;
  const s = getSettings();
  songGain.gain.value = s.volume; sfxGain.gain.value = s.hitVolume;
}
// Output-locked clock: AudioContext time of the sample currently leaving the speakers.
export function outNow() {
  if (!ac) return 0;
  const lat = (ac.outputLatency || 0) + (ac.baseLatency || 0);
  if (ac.getOutputTimestamp) {
    const ts = ac.getOutputTimestamp();
    if (ts.contextTime > 0 && ac.state === 'running') return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
  }
  return ac.currentTime - lat;
}
// Same clock, for an input event's timestamp (performance timeline).
export function outAt(perfMs) {
  if (!ac) return 0;
  const lat = (ac.outputLatency || 0) + (ac.baseLatency || 0);
  if (ac.getOutputTimestamp) {
    const ts = ac.getOutputTimestamp();
    if (ts.contextTime > 0 && ac.state === 'running') return ts.contextTime + (perfMs - ts.performanceTime) / 1000;
  }
  return ac.currentTime - lat - (performance.now() - perfMs) / 1000;
}
// Bass / mid / high energy 0..1 from whatever is playing (drives the background).
export function energy() {
  if (!analyser) return [0, 0, 0];
  analyser.getByteFrequencyData(freqData);
  const band = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += freqData[i]; return s / ((b - a) * 255); };
  return [band(1, 6), band(6, 40), band(40, 140)];
}

// ---------- song player
export class Player {
  constructor(buffer) { this.buffer = buffer; this.src = null; this.rate = 1; this.startCtx = 0; this.startPos = 0; this.playing = false; }
  play(pos = 0, rate = 1, delay = 0) {
    ctx(); this.stop();
    this.rate = rate;
    const s = ac.createBufferSource();
    s.buffer = this.buffer; s.playbackRate.value = rate; s.connect(songGain);
    const when = ac.currentTime + delay;
    if (pos >= 0) s.start(when, pos);
    else s.start(when - pos / rate, 0); // negative pos = lead-in silence
    this.startCtx = when; this.startPos = pos; this.src = s; this.playing = true;
    s.onended = () => { if (this.src === s) { this.startPos = this.buffer.duration; this.playing = false; } };
  }
  // song time in seconds at the speakers
  time() { return this.playing ? (outNow() - this.startCtx) * this.rate + this.startPos : this.startPos; }
  timeAt(perfMs) { return (outAt(perfMs) - this.startCtx) * this.rate + this.startPos; }
  stop() { if (this.src) { try { this.src.stop(); } catch {} this.src.disconnect(); } if (this.playing) this.startPos = this.time(); this.src = null; this.playing = false; }
  get duration() { return this.buffer.duration; }
}

// ---------- hit sounds: short pitched blip per side, noise tick on chords
const LANE_HZ = [880, 740, 587, 659];
export function hitSound(lane, kind = 'tap') {
  if (!ac || !getSettings().hitsounds) return;
  const t = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = kind === 'end' ? 'triangle' : 'square';
  o.frequency.setValueAtTime(LANE_HZ[lane] * (kind === 'end' ? 2 : 1), t);
  o.frequency.exponentialRampToValueAtTime(LANE_HZ[lane] * 0.5, t + 0.06);
  g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  o.connect(g).connect(sfxGain); o.start(t); o.stop(t + 0.08);
}
export function missSound() {
  if (!ac || !getSettings().hitsounds) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.15);
  g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g).connect(sfxGain); o.start(t); o.stop(t + 0.17);
}
export function click(when, accent = false) {
  ctx();
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'square'; o.frequency.value = accent ? 1760 : 1320;
  g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.25, when + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
  o.connect(g).connect(sfxGain); o.start(when); o.stop(when + 0.05);
}

// ---------- loading songs
const mem = new Map();
export const songKey = song => song.source + ':' + song.ref;
export function songUrl(song) {
  if (song.source === 'audius') return '/api/audius/stream/' + song.ref;
  if (song.source === 'upload') return '/api/audio/' + song.ref;
  return null;
}
export async function decode(arrayBuf) {
  ctx();
  return await new Promise((res, rej) => {
    const p = ac.decodeAudioData(arrayBuf.slice(0), res, rej);
    if (p && p.then) p.then(res, rej);
  });
}
export async function loadSong(song, onProgress) {
  const key = songKey(song);
  if (mem.has(key)) return mem.get(key);
  let buf;
  if (song.source === 'builtin') buf = await renderDemo();
  else {
    let raw = await idb.audio(key).catch(() => null);
    if (!raw) {
      const url = songUrl(song);
      if (url) raw = await fetchWithProgress(url, onProgress);
      else raw = await (await pickAudioFile(song)).arrayBuffer();
      idb.putAudio(key, raw).catch(() => {});
    }
    buf = await decode(raw);
  }
  mem.set(key, buf);
  return buf;
}
export function rememberBuffer(song, buf) { mem.set(songKey(song), buf); }
async function fetchWithProgress(url, onProgress) {
  const r = await fetch(url);
  if (!r.ok) { let m = 'download failed'; try { m = (await r.json()).error || m; } catch {} throw new Error(m); }
  const total = +r.headers.get('content-length') || 0;
  if (!r.body || !onProgress) return await r.arrayBuffer();
  const reader = r.body.getReader(), parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); got += value.length;
    onProgress(total ? got / total : -got);
  }
  const out = new Uint8Array(got); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out.buffer;
}

// ---------- built-in demo: "Square One", 128 BPM, 32 bars, synthesized offline
export const DEMO = { bpm: 128, bars: 32, title: 'Square One', artist: 'Beatsqare House Band' };
let demoP;
export function renderDemo() {
  return demoP ||= (async () => {
    const sr = 44100, beat = 60 / DEMO.bpm, len = DEMO.bars * 4 * beat + 2;
    const oc = new OfflineAudioContext(2, Math.ceil(len * sr), sr);
    const out = oc.createGain(); out.gain.value = 0.8;
    const comp = oc.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    out.connect(comp).connect(oc.destination);
    const noise = oc.createBuffer(1, sr, sr); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const hz = m => 440 * 2 ** ((m - 69) / 12);
    const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    const kick = t => { const o = oc.createOscillator(), g = oc.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); env(g, t, 0.002, 0.9, 0.28); o.connect(g).connect(out); o.start(t); o.stop(t + 0.35); };
    const nz = (t, dur, f, q, peak, type = 'highpass') => { const s = oc.createBufferSource(), fl = oc.createBiquadFilter(), g = oc.createGain(); s.buffer = noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q; env(g, t, 0.001, peak, dur); s.connect(fl).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); };
    const tone = (t, m, dur, type, peak, cut = 4000, pan = 0) => {
      const o = oc.createOscillator(), f = oc.createBiquadFilter(), g = oc.createGain(), p = oc.createStereoPanner();
      o.type = type; o.frequency.value = hz(m); f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t); f.frequency.exponentialRampToValueAtTime(Math.max(200, cut / 4), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.008); g.gain.setValueAtTime(peak, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      p.pan.value = pan; o.connect(f).connect(g).connect(p).connect(out); o.start(t); o.stop(t + dur + 0.02);
    };
    // A minor: Am  F  C  G
    const roots = [45, 41, 48, 43];
    const chords = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];
    const lead = [69, 72, 74, 76, 74, 72, 69, 67, 69, 72, 76, 79, 76, 74, 72, 74];
    for (let bar = 0; bar < DEMO.bars; bar++) {
      const sec = sectionOf(bar), bt = bar * 4 * beat, ch = bar % 4;
      for (let b = 0; b < 4; b++) {
        const t = bt + b * beat;
        if (sec !== 'break') kick(t);
        if (sec !== 'intro' && (b === 1 || b === 3)) nz(t, 0.16, 1800, 0.7, sec === 'break' ? 0.15 : 0.45, 'bandpass');
        for (let e = 0; e < 2; e++) nz(t + e * beat / 2, 0.04, 8000, 0.5, e ? 0.16 : 0.09);
        if (sec !== 'intro' && sec !== 'break') { tone(t + beat / 2, roots[ch] - 12 + 12, beat * 0.45, 'sawtooth', 0.22, 900); tone(t, roots[ch] - 12, beat * 0.4, 'square', 0.16, 600); }
      }
      if (sec === 'B' || sec === 'break' || sec === 'drop') for (const m of chords[ch]) tone(bt, m, beat * 4, 'sawtooth', 0.045, sec === 'break' ? 1400 : 2600, (m % 3 - 1) * 0.4);
      if (sec === 'A' || sec === 'drop') for (let s = 0; s < 8; s++) {
        const m = lead[(bar % 2) * 8 + s] + (sec === 'drop' ? 12 : 0);
        if ((s + bar) % 3 !== 2) tone(bt + s * beat / 2, m, beat * 0.42, 'square', 0.07, 5000, 0.2);
      }
      if (sec === 'break') tone(bt, chords[ch][2] + 12, beat * 4, 'triangle', 0.08, 3000);
    }
    return await oc.startRendering();
  })();
}
export function sectionOf(bar) { return bar < 4 ? 'intro' : bar < 12 ? 'A' : bar < 20 ? 'B' : bar < 24 ? 'break' : 'drop'; }
