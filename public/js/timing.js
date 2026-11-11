// Timing points: a chart can change tempo. chart.timing = [{ t, bpm }, …] sorted by t, where t is a beat
// (the downbeat of a bar) at which that tempo starts. Bars restart at each point. Charts without timing
// use their single bpm/offset.

export function points(chart) {
  const tp = Array.isArray(chart.timing) && chart.timing.length
    ? chart.timing.filter(p => Number.isFinite(p.t) && p.bpm > 0).map(p => ({ t: +p.t, bpm: +p.bpm })).sort((a, b) => a.t - b.t)
    : [];
  return tp.length ? tp : [{ t: chart.offset || 0, bpm: chart.bpm || 120 }];
}

// index of the timing point in force at time t (times before the first point use the first)
export function indexAt(tp, t) {
  let i = 0;
  while (i + 1 < tp.length && tp[i + 1].t <= t + 1e-6) i++;
  return i;
}
export const pointAt = (tp, t) => tp[indexAt(tp, t)];

// beat position inside the active section: { i, beat } where beat is fractional beats since that point
export function beatAt(tp, t) {
  const i = indexAt(tp, t), p = tp[i];
  return { i, beat: (t - p.t) / (60 / p.bpm) };
}

// global beat counter that keeps increasing across sections (for "did a new beat start?")
export function beatKey(tp, t) {
  const { i, beat } = beatAt(tp, t);
  return i * 100000 + Math.floor(beat);
}

// snap a time to the grid of its section (div = 1, 2, 4, 8 per beat); never crosses into the next section
export function snap(tp, t, div) {
  const i = indexAt(tp, t), p = tp[i], step = 60 / p.bpm / div;
  let s = p.t + Math.round((t - p.t) / step) * step;
  const next = tp[i + 1];
  if (next && s >= next.t - 1e-6) s = next.t;
  if (i > 0 && s < p.t) s = p.t;
  return s;
}

// grid lines between t0 and t1: [{ t, bar: bool, beat: bool, barNo }] with bar numbers running across sections
export function gridLines(tp, t0, t1, div, minPx, pps) {
  const out = [];
  let barBase = 0;
  for (let i = 0; i < tp.length; i++) {
    const p = tp[i], per = 60 / p.bpm, step = per / div, end = i + 1 < tp.length ? tp[i + 1].t : Infinity;
    const start = i === 0 ? -Infinity : p.t;
    const bars = end === Infinity ? 0 : Math.ceil((end - p.t) / per / 4 - 1e-6);
    const a = Math.max(t0, start), b = Math.min(t1, end);
    if (a < b) {
      const k0 = Math.ceil((a - p.t) / step - 1e-6), k1 = Math.floor((b - p.t) / step + 1e-6);
      const showSub = step * pps >= minPx, showBeat = per * pps >= minPx * 0.6;
      for (let k = k0; k <= k1; k++) {
        const t = p.t + k * step;
        if (t >= end - 1e-6) continue;
        const isBeat = k % div === 0, beatNo = Math.round(k / div), isBar = isBeat && ((beatNo % 4) + 4) % 4 === 0;
        if (!isBeat && !showSub) continue;
        if (isBeat && !isBar && !showBeat) continue;
        out.push({ t, bar: isBar, beat: isBeat, barNo: barBase + Math.floor(beatNo / 4) + 1 });
      }
    }
    barBase += bars;
  }
  return out;
}

// "128" or "105–135"
export function bpmLabel(chart) {
  const tp = points(chart), lo = Math.min(...tp.map(p => p.bpm)), hi = Math.max(...tp.map(p => p.bpm));
  const f = v => +(+v).toFixed(1);
  return lo === hi ? String(f(lo)) : `${f(lo)}–${f(hi)}`;
}

// sanitise for storage / publishing
export function cleanTiming(timing) {
  if (!Array.isArray(timing)) return undefined;
  const out = timing.filter(p => Number.isFinite(+p.t) && +p.bpm >= 20 && +p.bpm <= 400).slice(0, 64)
    .map(p => ({ t: +(+p.t).toFixed(4), bpm: +(+p.bpm).toFixed(3) })).sort((a, b) => a.t - b.t);
  return out.length > 1 ? out : undefined;
}

// bar and beat numbers (1-based) at time t, with bars counted across sections
export function barBeat(tp, t) {
  const i = indexAt(tp, t);
  let bars = 0;
  for (let j = 0; j < i; j++) bars += Math.ceil((tp[j + 1].t - tp[j].t) / (60 / tp[j].bpm) / 4 - 1e-6);
  const beat = Math.floor((t - tp[i].t) / (60 / tp[i].bpm));
  return { bar: bars + Math.floor(beat / 4) + 1, beat: ((beat % 4) + 4) % 4 + 1, section: i + 1, sections: tp.length };
}
