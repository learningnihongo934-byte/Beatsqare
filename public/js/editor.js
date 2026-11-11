// Level editor: waveform timeline, beat grid with snapping, 4 lanes, holds, chords, pierce notes,
// selection + clipboard, undo/redo, slowed playback, BPM detection, auto-chart, playtest, JSON in/out, publish.
import { ctx, Player, loadSong, hitSound, click, ac, songKey } from './audio.js';
import { peaksOf, analyze, detectBpm, detectSections, autoChartTimed } from './analysis.js';
import { points, snap as snapT, indexAt, gridLines, barBeat, beatAt, cleanTiming } from './timing.js';
import { playChart } from './game.js';
import { exportPack, downloadBytes } from './pack.js';
import { COLORS, BALL, LANE_NAMES, DIFFS, adjacent, idb, api, toast, esc, icon, fmtTime, clamp, downloadText, slug, getSettings, uploadFile } from './util.js';

const analysisCache = new Map();
export async function getAnalysis(song, buffer, onProgress) {
  const k = songKey(song);
  if (!analysisCache.has(k)) analysisCache.set(k, analyze(buffer, onProgress));
  return analysisCache.get(k);
}

export async function openEditor(chartId, nav) {
  const chart = await idb.chart(chartId);
  if (!chart) { toast('Chart not found on this device', true); nav('#/create'); return () => {}; }
  ctx();
  const root = document.createElement('div');
  root.className = 'ed';
  root.innerHTML = `
    <div class="ed-top">
      <a class="btn sm" href="#/library" title="Back to library">&larr; Library</a>
      <div class="ttl"><input data-f="title" value="${esc(chart.title)}" aria-label="Chart title" maxlength="80"></div>
      <span class="lbl" data-saved>Saved</span>
      <button class="btn sm" data-a="playtest" style="--c:var(--down)" title="Playtest from the playhead (P)">${icon('play')}Playtest from here</button>
      <button class="btn sm" data-a="pack" title="Song + charts in one .bsq file">${icon('down')}.bsq</button>
      <button class="btn sm" data-a="export" title="Download chart JSON">${icon('down')}JSON</button>
      <label class="btn sm" title="Load chart JSON">${icon('up')}Import<input type="file" accept=".json,application/json" hidden data-import></label>
      <button class="btn sm pri" data-a="publish" style="--c:var(--right)">Publish</button>
      <button class="btn sm" data-a="side" aria-label="Chart info">${icon('menu')}</button>
    </div>
    <div class="ed-tools">
      <button class="btn sm" data-a="play" style="min-width:74px" title="Play / pause (Space)">${icon('play')}Play</button>
      <div class="seg" data-seg="rate" title="Playback speed"><button data-v="1" class="on">1×</button><button data-v="0.75">0.75×</button><button data-v="0.5">0.5×</button></div>
      <span class="sep"></span>
      <span class="lbl">BPM</span><input class="input bpm" data-f="bpm" type="number" step="0.01" min="40" max="300" value="${chart.bpm}">
      <button class="btn sm" data-a="detect" title="Detect BPM and first beat">Detect</button>
      <button class="btn sm" data-a="tap" title="Tap tempo (T)">Tap</button>
      <button class="btn sm" data-a="tpadd" style="--c:var(--ball)" title="Start a new tempo section at the playhead">+ Tempo</button>
      <button class="btn sm" data-a="tpdel" style="--c:var(--ball)" title="Remove the tempo section under the playhead">− Tempo</button>
      <span class="lbl" data-tp></span>
      <span class="sep"></span>
      <span class="lbl">Snap</span>
      <div class="seg" data-seg="snap" style="--c:var(--left)"><button data-v="1">1/1</button><button data-v="2">1/2</button><button data-v="4" class="on">1/4</button><button data-v="8">1/8</button></div>
      <span class="sep"></span>
      <div class="seg" data-seg="tool" style="--c:var(--down)"><button data-v="note" class="on" title="Note tool (N): click = tap, drag = hold, shift-click = chord">Note</button><button data-v="pierce" title="Pierce tool (I)">Pierce</button><button data-v="select" title="Select tool (V)">Select</button></div>
      <button class="btn sm" data-a="undo" title="Undo (Ctrl+Z)">${icon('undo')}</button>
      <button class="btn sm" data-a="redo" title="Redo (Ctrl+Shift+Z)">${icon('redo')}</button>
      <span class="sep"></span>
      <button class="btn sm" data-a="zoomout" aria-label="Zoom out">−</button><button class="btn sm" data-a="zoomin" aria-label="Zoom in">+</button>
      <span class="sep"></span>
      <select class="input" data-f="autodiff" style="width:auto;min-height:30px;padding:3px 28px 3px 8px;font-size:11px">${DIFFS.map(d => `<option ${d === chart.difficulty ? 'selected' : ''}>${d}</option>`).join('')}</select>
      <button class="btn sm" data-a="auto" style="--c:var(--right)" title="Draft a chart from onset detection">${icon('wand')}Auto-chart</button>
    </div>
    <div class="ed-main">
      <div class="ed-canvas"><canvas></canvas></div>
      <aside class="ed-side">
        <div class="field"><span class="lbl">Artist</span><input class="input" data-f="artist" value="${esc(chart.artist || '')}" maxlength="80"></div>
        <div class="row" style="gap:8px">
          <div class="field" style="flex:1"><span class="lbl">Difficulty</span><select class="input" data-f="difficulty">${DIFFS.map(d => `<option ${d === chart.difficulty ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
          <div class="field" style="width:70px"><span class="lbl">Level</span><input class="input" data-f="level" type="number" min="1" max="15" value="${chart.level || 5}"></div>
        </div>
        <div class="field"><span class="lbl">Section first beat (ms)</span><input class="input" data-f="offset" type="number" step="1" value="${Math.round((chart.offset || 0) * 1000)}"></div>
        <label class="row" style="font-size:12px"><input type="checkbox" data-f="metro"> Metronome</label>
        <label class="row" style="font-size:12px"><input type="checkbox" data-f="ticks" checked> Note ticks</label>
        <div><span class="lbl">Song</span><p style="margin:4px 0 0;font-size:12px">${esc(chart.song.credit || chart.artist || '')}<br><span class="muted">${esc(chart.song.license || '')}</span></p></div>
        <div data-stats class="help"></div>
        <div class="help">
          <b>Click</b> tap note · <b>drag right</b> hold · <b>Shift-click</b> chord (corner) · <b>Right-click</b> delete<br>
          <b>1 2 3 4</b> place Up/Right/Down/Left at playhead · <b>Space</b> play · <b>← →</b> step · <b>P</b> playtest<br>
          <b>Ctrl+C/X/V</b> copy/cut/paste at playhead · <b>Ctrl+A</b> all · <b>Del</b> delete · <b>M</b> mirror selection<br>
          <b>Wheel</b> scroll · <b>Ctrl+wheel</b> zoom · click the waveform to seek
        </div>
      </aside>
    </div>
    <div class="ed-foot"><span><span class="num" data-time>0:00.000</span> / ${fmtTime(chart.duration)}</span><span data-beat></span><span data-count></span><span data-sel></span></div>
    <div class="loading" data-loading><div><div class="lbl">Loading song</div><div class="num" style="font-size:36px" data-pct>…</div></div></div>`;
  document.body.appendChild(root);
  const cv = root.querySelector('canvas'), g = cv.getContext('2d');
  const wrap = root.querySelector('.ed-canvas');
  const $f = n => root.querySelector(`[data-f="${n}"]`);

  // ---------- state
  let buffer;
  try { buffer = await loadSong(chart.song, p => { root.querySelector('[data-pct]').textContent = p >= 0 ? Math.round(p * 100) + '%' : Math.round(-p / 1024) + ' KB'; }); }
  catch (e) { root.querySelector('[data-loading]').innerHTML = `<div><p>Could not load the song: ${esc(e.message)}</p><a class="btn" href="#/library">Back</a></div>`; return () => root.remove(); }
  chart.duration = buffer.duration;
  const peaks = peaksOf(buffer);
  const player = new Player(buffer);
  let notes = chart.notes.map(n => ({ ...n }));
  let pos = 0, rate = 1, snapDiv = 4, tool = 'note', pps = 240, viewStart = -0.5;
  let sel = new Set(), clip = [], undoStack = [], redoStack = [];
  let hover = null, drag = null, dirty = false, saveT = 0;
  let W = 0, H = 0, dpr = 1;
  const WAVE = 64, RULER = 18;
  const laneTop = () => WAVE + RULER;
  const laneH = () => Math.max(36, (H - laneTop() - 6) / 4);
  const xOf = t => (t - viewStart) * pps;
  const tOf = x => x / pps + viewStart;
  const TP = () => points(chart);
  const subAt = t => { const tp = TP(); return 60 / tp[indexAt(tp, t)].bpm / snapDiv; };
  const sub = () => subAt(pos);
  const snap = t => snapT(TP(), t, snapDiv);
  // timing points: chart.timing holds 2+ sections; one section lives in chart.bpm / chart.offset
  function setTiming(tp) {
    tp = tp.map(p => ({ t: +p.t, bpm: clamp(+p.bpm || 120, 40, 300) })).sort((a, b) => a.t - b.t);
    if (tp.length > 1) chart.timing = cleanTiming(tp); else delete chart.timing;
    chart.bpm = tp[0].bpm;
    const per = 60 / tp[0].bpm; chart.offset = +(tp[0].t - Math.floor(tp[0].t / per) * per).toFixed(4);
    if (!chart.timing) chart.offset = +tp[0].t.toFixed(4);
    syncTimingFields(true); markDirty();
  }
  let shownTp = -1;
  function syncTimingFields(force) {
    const tp = TP(), i = indexAt(tp, pos);
    if (!force && i === shownTp) return;
    shownTp = i;
    if (document.activeElement !== $f('bpm')) $f('bpm').value = +tp[i].bpm.toFixed(3);
    if (document.activeElement !== $f('offset')) $f('offset').value = Math.round(tp[i].t * 1000);
    root.querySelector('[data-tp]').textContent = tp.length > 1 ? `Tempo ${i + 1}/${tp.length}` : '';
  }
  const laneAt = y => y < laneTop() ? -1 : clamp(Math.floor((y - laneTop()) / laneH()), 0, 3);
  root.querySelector('[data-loading]').remove();

  function resize() {
    const r = wrap.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  const ro = new ResizeObserver(resize); ro.observe(wrap); resize();

  // ---------- history
  const snapshot = () => JSON.stringify(notes);
  function commit(before) { undoStack.push(before); if (undoStack.length > 300) undoStack.shift(); redoStack = []; markDirty(); }
  function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); notes = JSON.parse(undoStack.pop()); sel.clear(); markDirty(); }
  function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); notes = JSON.parse(redoStack.pop()); sel.clear(); markDirty(); }
  function markDirty() { dirty = true; root.querySelector('[data-saved]').textContent = 'Unsaved'; clearTimeout(saveT); saveT = setTimeout(save, 800); }
  async function save() {
    clearTimeout(saveT);
    notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
    Object.assign(chart, {
      notes: notes.map(n => { const o = { t: +n.t.toFixed(4), lane: n.lane }; if (n.len > 0.001) o.len = +n.len.toFixed(4); if (n.type === 'pierce') o.type = 'pierce'; return o; }),
      title: $f('title').value.trim() || 'Untitled', artist: $f('artist').value.trim(), difficulty: $f('difficulty').value,
      level: clamp(+$f('level').value || 5, 1, 15), updated: Date.now(),
    });
    await idb.putChart(chart);
    dirty = false; root.querySelector('[data-saved]').textContent = 'Saved';
  }

  // ---------- notes helpers
  const noteAt = (L, x) => {
    let best = null;
    for (const n of notes) if (n.lane === L) {
      const a = xOf(n.t) - 7, b = xOf(n.t + (n.len || 0)) + 7;
      if (x >= a && x <= b && (!best || Math.abs(xOf(n.t) - x) < Math.abs(xOf(best.t) - x))) best = n;
    }
    return best;
  };
  const exists = (L, t) => notes.some(n => n.lane === L && Math.abs(n.t - t) < 0.002);
  function add(L, t, extra = {}) { if (t < 0 || t > buffer.duration || exists(L, t)) return null; const n = { t, lane: L, ...extra }; notes.push(n); return n; }
  const neighbourRow = (L, upper) => upper ? (L + 3) % 4 : (L + 1) % 4; // rows are Up, Right, Down, Left — consecutive rows (and Left/Up) are adjacent sides

  // ---------- pointer
  wrap.addEventListener('contextmenu', e => e.preventDefault());
  wrap.addEventListener('pointerdown', e => {
    const r = wrap.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    wrap.setPointerCapture(e.pointerId);
    if (y < laneTop()) { drag = { kind: 'seek' }; seekTo(tOf(x)); return; }
    const L = laneAt(y), t = snap(tOf(x)), hit = noteAt(L, x);
    if (e.button === 2 || e.altKey) { if (hit) { const b = snapshot(); notes = notes.filter(n => n !== hit); sel.delete(hit); commit(b); } return; }
    if (tool === 'select' || e.ctrlKey || e.metaKey) {
      if (hit) { if (!e.shiftKey && !sel.has(hit)) sel.clear(); sel.add(hit); drag = { kind: 'move', x0: x, L0: L, before: snapshot(), orig: [...sel].map(n => [n, n.t, n.lane]) }; }
      else { if (!e.shiftKey) sel.clear(); drag = { kind: 'box', x0: x, y0: y, x1: x, y1: y }; }
      return;
    }
    if (hit) {
      if (hit.len && Math.abs(x - xOf(hit.t + hit.len)) < 8) { drag = { kind: 'len', n: hit, before: snapshot() }; return; }
      if (!e.shiftKey) sel.clear(); sel.add(hit);
      drag = { kind: 'move', x0: x, L0: L, before: snapshot(), orig: [...sel].map(n => [n, n.t, n.lane]) };
      return;
    }
    const before = snapshot();
    sel.clear();
    if (e.shiftKey) { // chord: this lane + the adjacent row nearest the click
      const upper = (y - laneTop()) % laneH() < laneH() / 2;
      const a = add(L, t, tool === 'pierce' ? { type: 'pierce' } : {}), b = add(neighbourRow(L, upper), t);
      if (a || b) commit(before);
      return;
    }
    const n = add(L, t, tool === 'pierce' ? { type: 'pierce' } : {});
    if (n) { if (tool !== 'pierce') drag = { kind: 'len', n, before, fresh: true }; else commit(before); }
  });
  wrap.addEventListener('pointermove', e => {
    const r = wrap.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    hover = y >= laneTop() ? { L: laneAt(y), t: snap(tOf(x)), shift: e.shiftKey, upper: (y - laneTop()) % laneH() < laneH() / 2 } : null;
    if (!drag) { wrap.style.cursor = y < laneTop() ? 'ew-resize' : 'crosshair'; return; }
    if (drag.kind === 'seek') seekTo(tOf(x));
    else if (drag.kind === 'len') { const end = snap(tOf(x)); drag.n.len = Math.max(0, end - drag.n.t); }
    else if (drag.kind === 'box') { drag.x1 = x; drag.y1 = y; }
    else if (drag.kind === 'move') {
      const st = subAt(drag.orig[0][1]), dt = Math.round((tOf(x) - tOf(drag.x0)) / st) * st, dL = laneAt(y) - drag.L0;
      for (const [n, t0, l0] of drag.orig) { n.t = Math.max(0, t0 + dt); n.lane = ((l0 + dL) % 4 + 4) % 4; }
    }
  });
  wrap.addEventListener('pointerup', () => {
    if (!drag) return;
    if (drag.kind === 'len') { if (drag.n.len < subAt(drag.n.t) * 0.99) delete drag.n.len; commit(drag.before); }
    if (drag.kind === 'move') { const changed = drag.orig.some(([n, t0, l0]) => n.t !== t0 || n.lane !== l0); if (changed) commit(drag.before); }
    if (drag.kind === 'box') {
      const ta = tOf(Math.min(drag.x0, drag.x1)), tb = tOf(Math.max(drag.x0, drag.x1));
      const la = laneAt(Math.min(drag.y0, drag.y1)), lb = laneAt(Math.max(drag.y0, drag.y1));
      for (const n of notes) if (n.t + (n.len || 0) >= ta && n.t <= tb && n.lane >= Math.max(0, la) && n.lane <= lb) sel.add(n);
    }
    drag = null;
  });
  wrap.addEventListener('pointerleave', () => { hover = null; });
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const r = wrap.getBoundingClientRect(), x = e.clientX - r.left;
    if (e.ctrlKey || e.metaKey) { const t = tOf(x); pps = clamp(pps * Math.exp(-e.deltaY * 0.002), 50, 1600); viewStart = t - x / pps; }
    else viewStart += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / pps;
    viewStart = clamp(viewStart, -2, buffer.duration);
  }, { passive: false });

  // ---------- transport
  let lastTick = 0, lastMetro = -1;
  function seekTo(t) { pos = clamp(t, 0, buffer.duration); if (player.playing) player.play(pos, rate); }
  function togglePlay() {
    if (player.playing) { player.stop(); pos = player.startPos; }
    else { player.play(pos, rate); lastTick = pos; const ba = beatAt(TP(), pos); lastMetro = ba.i * 100000 + Math.floor(ba.beat); }
    root.querySelector('[data-a=play]').innerHTML = player.playing ? icon('pause') + 'Pause' : icon('play') + 'Play';
  }
  const tapTimes = [];
  function tapTempo() {
    const t = performance.now() / 1000;
    if (tapTimes.length && t - tapTimes[tapTimes.length - 1] > 2) tapTimes.length = 0;
    tapTimes.push(t);
    if (tapTimes.length >= 4) {
      const iv = (tapTimes[tapTimes.length - 1] - tapTimes[0]) / (tapTimes.length - 1);
      setBpm(Math.round(60 / iv * 10) / 10);
    } else toast(`Tap ${4 - tapTimes.length} more`);
  }
  function setBpm(v) { const tp = TP(); tp[indexAt(tp, pos)].bpm = clamp(+v || 120, 40, 300); setTiming(tp); }

  // ---------- toolbar
  root.addEventListener('click', async e => {
    const segB = e.target.closest('.seg button');
    if (segB) {
      const seg = segB.parentElement.dataset.seg, v = segB.dataset.v;
      segB.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === segB));
      if (seg === 'rate') { rate = +v; if (player.playing) { const p = player.time(); player.play(p, rate); } }
      if (seg === 'snap') snapDiv = +v;
      if (seg === 'tool') tool = v;
      return;
    }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'play') togglePlay();
    if (a === 'undo') undo();
    if (a === 'redo') redo();
    if (a === 'zoomin') zoom(1.4);
    if (a === 'zoomout') zoom(1 / 1.4);
    if (a === 'tap') tapTempo();
    if (a === 'tpadd') {
      const tp = TP(), t = snap(pos), cur = tp[indexAt(tp, t)];
      if (tp.some(p => Math.abs(p.t - t) < 0.05)) { toast('There is already a tempo change here', true); return; }
      tp.push({ t, bpm: cur.bpm }); setTiming(tp); toast('New tempo section: set its BPM and first beat');
    }
    if (a === 'tpdel') {
      const tp = TP(), i = indexAt(tp, pos);
      if (tp.length < 2 || i === 0) { toast('The first tempo can’t be removed; edit its BPM instead', true); return; }
      tp.splice(i, 1); setTiming(tp); toast('Tempo section removed');
    }
    if (a === 'side') root.querySelector('.ed-side').classList.toggle('open');
    if (a === 'detect') await detect();
    if (a === 'auto') await runAuto();
    if (a === 'playtest') await playtest();
    if (a === 'export') { await save(); downloadText(slug(chart.title) + '-' + chart.difficulty.toLowerCase() + '.beatsqare.json', exportJson()); }
    if (a === 'publish') await publish();
    if (a === 'pack') { await save(); toast('Packing…'); try { downloadBytes(slug(chart.title) + '.bsq', await exportPack(chart)); } catch (err) { toast('Export failed: ' + err.message, true); } }
  });
  function zoom(f) { const t = player.playing ? player.time() : pos, cx = clamp(xOf(t), 0, W); pps = clamp(pps * f, 50, 1600); viewStart = clamp(t - cx / pps, -2, buffer.duration); }
  root.addEventListener('change', e => {
    const f = e.target.dataset.f;
    if (f === 'bpm') setBpm(e.target.value);
    else if (f === 'offset') { const tp = TP(); tp[indexAt(tp, pos)].t = (+e.target.value || 0) / 1000; setTiming(tp); }
    else if (['title', 'artist', 'difficulty', 'level'].includes(f)) markDirty();
  });
  root.querySelector('[data-import]').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.notes)) throw new Error('no notes in file');
      const b = snapshot();
      notes = data.notes.filter(n => Number.isFinite(n.t) && n.lane >= 0 && n.lane <= 3).map(n => ({ t: n.t, lane: n.lane | 0, ...(n.len ? { len: n.len } : {}), ...(n.type === 'pierce' ? { type: 'pierce' } : {}) }));
      if (cleanTiming(data.timing)) setTiming(data.timing);
      else if (data.bpm) setTiming([{ t: Number.isFinite(data.offset) ? data.offset : chart.offset, bpm: data.bpm }]);
      if (data.difficulty && DIFFS.includes(data.difficulty)) $f('difficulty').value = data.difficulty;
      commit(b); toast(`Imported ${notes.length} notes`);
    } catch (err) { toast('Import failed: ' + err.message, true); }
    e.target.value = '';
  });
  const exportJson = () => JSON.stringify({ format: 'beatsqare-chart', v: 1, title: chart.title, artist: chart.artist, difficulty: chart.difficulty, level: chart.level, bpm: chart.bpm, offset: chart.offset, timing: chart.timing, duration: chart.duration, song: chart.song, notes: chart.notes }, null, 1);

  async function detect() {
    const busy = toastBusy('Detecting BPM…');
    try {
      const A = await getAnalysis(chart.song, buffer);
      const r = detectBpm(A);
      toast('Checking for tempo changes…');
      const tp = await detectSections(A, r);
      setTiming(tp);
      toast(tp.length > 1 ? `Found ${tp.length} tempo sections: ${tp.map(p => +p.bpm.toFixed(1)).join(' → ')} BPM` : `BPM ${r.bpm} · first beat ${Math.round(r.offset * 1000)} ms`);
    } finally { busy(); }
  }
  async function runAuto() {
    if (notes.length && !confirm('Replace the current notes with an auto-chart draft?')) return;
    const busy = toastBusy('Listening for onsets…');
    try {
      const A = await getAnalysis(chart.song, buffer);
      const b = snapshot();
      const d = $f('autodiff').value;
      notes = autoChartTimed(A, TP(), d);
      $f('difficulty').value = d; $f('level').value = { Easy: 3, Normal: 6, Hard: 9, Expert: 12 }[d];
      commit(b); toast(`Drafted ${notes.length} notes · edit away`);
    } finally { busy(); }
  }
  function toastBusy(msg) { toast(msg); root.style.cursor = 'progress'; return () => (root.style.cursor = ''); }

  async function playtest() {
    if (player.playing) togglePlay();
    await save();
    if (!chart.notes.some(n => n.t >= pos - 0.01)) { toast('No notes after the playhead', true); return; }
    root.style.display = 'none'; stopLoop();
    let action = 'restart';
    while (action === 'restart') ({ action } = await playChart(chart, { start: pos, playtest: true }));
    root.style.display = ''; startLoop(); resize();
  }

  async function publish() {
    await save();
    if (chart.notes.length < 8) { toast('Add at least 8 notes before publishing', true); return; }
    try {
      if (chart.song.source === 'local') {
        toast('Uploading song…');
        const raw = await idb.audio(songKey(chart.song));
        if (!raw) throw new Error('song file missing on this device');
        const file = new File([raw], chart.song.credit || 'song', { type: chart.song.mime || 'audio/mpeg' });
        const up = await uploadFile(file);
        await idb.putAudio('upload:' + up.id, raw);
        chart.song = { ...chart.song, source: 'upload', ref: up.id };
      }
      const S = getSettings();
      const { id } = await api('/charts', { method: 'POST', body: JSON.stringify({ ...JSON.parse(exportJson()), author: S.handle }) });
      chart.catalogId = id; await idb.putChart(chart);
      toast('Published to the catalog');
    } catch (err) { toast('Publish failed: ' + err.message, true); }
  }

  // ---------- keyboard
  function onKey(e) {
    if (root.style.display === 'none') return;
    if (e.target?.matches?.('input,select,textarea')) { if (e.key === 'Enter') e.target.blur(); return; }
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); togglePlay(); return; }
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k === 's') { e.preventDefault(); save().then(() => toast('Saved')); return; }
    if (mod && k === 'a') { e.preventDefault(); sel = new Set(notes); return; }
    if (mod && (k === 'c' || k === 'x')) {
      if (!sel.size) return; e.preventDefault();
      const s = [...sel], t0 = Math.min(...s.map(n => n.t));
      clip = s.map(n => ({ ...n, t: n.t - t0 }));
      if (k === 'x') { const b = snapshot(); notes = notes.filter(n => !sel.has(n)); sel.clear(); commit(b); }
      toast(`${k === 'x' ? 'Cut' : 'Copied'} ${clip.length} notes`); return;
    }
    if (mod && k === 'v') {
      if (!clip.length) return; e.preventDefault();
      const b = snapshot(), at = snap(player.playing ? player.time() : pos); sel.clear();
      for (const c of clip) { const n = add(c.lane, at + c.t, { ...(c.len ? { len: c.len } : {}), ...(c.type ? { type: c.type } : {}) }); if (n) sel.add(n); }
      commit(b); return;
    }
    if ((k === 'delete' || k === 'backspace') && sel.size) { e.preventDefault(); const b = snapshot(); notes = notes.filter(n => !sel.has(n)); sel.clear(); commit(b); return; }
    if (k === 'escape') { sel.clear(); return; }
    if (k === 'm' && sel.size) { const b = snapshot(); for (const n of sel) if (n.lane % 2) n.lane = n.lane === 1 ? 3 : 1; commit(b); return; }
    if (k === 'p' && !mod) { playtest(); return; }
    if (k === 't' && !mod) { tapTempo(); return; }
    if (k === 'n') return setTool('note');
    if (k === 'i') return setTool('pierce');
    if (k === 'v' && !mod) return setTool('select');
    if (['1', '2', '3', '4'].includes(k)) { const b = snapshot(); const n = add(+k - 1, snap(player.playing ? player.time() : pos)); if (n) commit(b); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const d = e.key === 'ArrowRight' ? 1 : -1; seekTo(snap(pos) + d * sub() * (e.shiftKey ? snapDiv * 4 : 1)); return; }
    if (k === '=' || k === '+') zoom(1.25);
    if (k === '-') zoom(0.8);
  }
  function setTool(t) { tool = t; root.querySelectorAll('[data-seg=tool] button').forEach(b => b.classList.toggle('on', b.dataset.v === t)); }
  addEventListener('keydown', onKey);

  // ---------- render loop
  let raf = 0;
  function startLoop() { if (!raf) raf = requestAnimationFrame(frame); }
  function stopLoop() { cancelAnimationFrame(raf); raf = 0; if (player.playing) togglePlay(); }
  const tEl = root.querySelector('[data-time]'), bEl = root.querySelector('[data-beat]'), cEl = root.querySelector('[data-count]'), sEl = root.querySelector('[data-sel]'), stEl = root.querySelector('[data-stats]');
  let statsKey = '';
  function frame() {
    raf = requestAnimationFrame(frame);
    const now = player.playing ? player.time() : pos;
    if (player.playing) {
      pos = now;
      if (now >= buffer.duration - 0.01) togglePlay();
      // follow: keep the playhead at 30% of the view
      const want = now - (W * 0.3) / pps;
      if (xOf(now) > W * 0.7 || xOf(now) < 0) viewStart = want; else viewStart += (want - viewStart) * 0.08;
      if ($f('ticks').checked) for (const n of notes) if (n.t > lastTick && n.t <= now) hitSound(n.lane);
      if ($f('metro').checked) { const ba = beatAt(TP(), now), bi = Math.floor(ba.beat), key = ba.i * 100000 + bi; if (key !== lastMetro) { lastMetro = key; if (bi >= 0 || ba.i > 0) click(ac.currentTime, ((bi % 4) + 4) % 4 === 0); } }
      lastTick = now;
    } else if (!drag && (xOf(pos) < 0 || xOf(pos) > W)) viewStart = clamp(pos - (W * 0.3) / pps, -2, buffer.duration); // keep a paused playhead in view
    draw(now);
    syncTimingFields(false);
    const bb = barBeat(TP(), now);
    tEl.textContent = `${Math.floor(now / 60)}:${(now % 60).toFixed(3).padStart(6, '0')}`;
    bEl.textContent = `Bar ${bb.bar} · Beat ${bb.beat}${bb.sections > 1 ? ` · ${+TP()[bb.section - 1].bpm.toFixed(1)} BPM` : ''}`;
    cEl.textContent = `${notes.length} notes`;
    sEl.textContent = sel.size ? `${sel.size} selected` : '';
    const sk = notes.length + ':' + chart.bpm + ':' + (chart.timing ? chart.timing.length : 1);
    if (sk !== statsKey) {
      statsKey = sk;
      const holds = notes.filter(n => n.len).length, pierce = notes.filter(n => n.type === 'pierce').length;
      let chords = 0; const byT = new Map(); for (const n of notes) { const k2 = n.t.toFixed(3); byT.set(k2, (byT.get(k2) || 0) + 1); } for (const v of byT.values()) if (v > 1) chords++;
      stEl.innerHTML = `<span class="lbl">Chart</span><br>${notes.length} notes · ${holds} holds · ${chords} chords · ${pierce} pierce<br>${(notes.length / Math.max(1, buffer.duration)).toFixed(2)} notes/sec`;
    }
  }
  function draw(now) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#05050a'; g.fillRect(0, 0, W, H);
    const lt = laneTop(), lh = laneH(), t0 = tOf(0), t1 = tOf(W);
    // lane rows
    for (let L = 0; L < 4; L++) {
      const y = lt + L * lh;
      g.fillStyle = L % 2 ? '#080912' : '#0a0b15'; g.fillRect(0, y, W, lh);
      g.fillStyle = COLORS[L]; g.globalAlpha = 0.9; g.fillRect(0, y, 3, lh); g.globalAlpha = 1;
      g.font = '500 10px "Martian Mono", monospace'; g.fillStyle = COLORS[L]; g.globalAlpha = 0.55; g.textBaseline = 'top'; g.fillText(LANE_NAMES[L].toUpperCase(), 8, y + 6); g.globalAlpha = 1;
    }
    // waveform
    g.fillStyle = '#090a12'; g.fillRect(0, 0, W, WAVE);
    const mid = WAVE / 2;
    for (let x = 0; x < W; x++) {
      const ta = tOf(x), tb = tOf(x + 1);
      if (tb < 0 || ta > buffer.duration) continue;
      let ia = Math.max(0, Math.floor(ta * peaks.rate)), ib = Math.min(peaks.min.length - 1, Math.ceil(tb * peaks.rate));
      let lo = 0, hi = 0; for (let i = ia; i <= ib; i++) { if (peaks.min[i] < lo) lo = peaks.min[i]; if (peaks.max[i] > hi) hi = peaks.max[i]; }
      g.fillStyle = ta < now ? '#19f0ff' : '#2b4a66'; g.globalAlpha = ta < now ? 0.75 : 1;
      g.fillRect(x, mid + lo * mid * 0.95, 1, Math.max(1, (hi - lo) * mid * 0.95));
    }
    g.globalAlpha = 1;
    // ruler + grid
    g.fillStyle = '#05050a'; g.fillRect(0, WAVE, W, RULER);
    const tpl = TP();
    for (const gl of gridLines(tpl, Math.max(0, t0), Math.min(buffer.duration, t1), snapDiv, 6, pps)) {
      const x = Math.round(xOf(gl.t)) + 0.5, isBar = gl.bar, isBeat = gl.beat;
      g.strokeStyle = isBar ? '#3a4562' : isBeat ? '#222a3e' : '#141826'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, isBar ? WAVE : lt); g.lineTo(x, lt + 4 * lh); g.stroke();
      if (isBar) { g.fillStyle = '#8a96ad'; g.font = '500 10px "Martian Mono", monospace'; g.textBaseline = 'middle'; g.fillText(String(gl.barNo), x + 4, WAVE + RULER / 2); }
    }
    // tempo changes: dashed marker + BPM tag in the ruler
    if (tpl.length > 1) for (const p of tpl) {
      const x = Math.round(xOf(p.t)) + 0.5; if (x < -60 || x > W) continue;
      g.setLineDash([2, 4]); g.strokeStyle = BALL; g.globalAlpha = 0.7; g.beginPath(); g.moveTo(x, WAVE); g.lineTo(x, lt + 4 * lh); g.stroke(); g.setLineDash([]);
      g.globalAlpha = 1; g.fillStyle = BALL; g.font = '600 10px "Martian Mono", monospace'; g.textBaseline = 'middle';
      const label = +p.bpm.toFixed(2) + ' BPM', w = g.measureText(label).width + 8;
      g.fillRect(x, WAVE + 2, w, RULER - 4); g.fillStyle = '#05050a'; g.fillText(label, x + 4, WAVE + RULER / 2);
    }
    g.strokeStyle = '#191e2c'; g.beginPath(); g.moveTo(0, WAVE + 0.5); g.lineTo(W, WAVE + 0.5); g.moveTo(0, lt + 0.5); g.lineTo(W, lt + 0.5); g.stroke();
    // chord connectors
    const byT = new Map();
    for (const n of notes) { if (n.t < t0 - 1 || n.t > t1 + 1) continue; const k = Math.round(n.t * 500); (byT.get(k) || byT.set(k, []).get(k)).push(n); }
    g.setLineDash([3, 3]); g.strokeStyle = '#ffffff'; g.globalAlpha = 0.5;
    for (const grp of byT.values()) if (grp.length > 1) {
      const ls = grp.map(n => n.lane).sort(), x = xOf(grp[0].t);
      g.beginPath(); g.moveTo(x, lt + ls[0] * lh + lh / 2); g.lineTo(x, lt + ls[ls.length - 1] * lh + lh / 2); g.stroke();
    }
    g.setLineDash([]); g.globalAlpha = 1;
    // notes
    for (const n of notes) {
      const x = xOf(n.t), xe = xOf(n.t + (n.len || 0));
      if (xe < -10 || x > W + 10) continue;
      const y = lt + n.lane * lh, c = COLORS[n.lane], h = lh * 0.56, yy = y + (lh - h) / 2;
      if (n.len) { g.fillStyle = c; g.globalAlpha = 0.28; g.fillRect(x, yy + h * 0.2, xe - x, h * 0.6); g.globalAlpha = 0.9; g.strokeStyle = c; g.lineWidth = 1; g.strokeRect(x + 0.5, yy + h * 0.2 + 0.5, xe - x, h * 0.6); g.fillRect(xe - 2, yy, 3, h); g.globalAlpha = 1; }
      if (n.type === 'pierce') { g.strokeStyle = c; g.lineWidth = 2; g.strokeRect(x - 5, yy, 10, h); g.beginPath(); g.moveTo(x - 2, yy + 4); g.lineTo(x - 2, yy + h - 4); g.moveTo(x + 2, yy + 4); g.lineTo(x + 2, yy + h - 4); g.stroke(); }
      else { g.fillStyle = c; g.fillRect(x - 5, yy, 10, h); g.fillStyle = '#fff'; g.globalAlpha = 0.6; g.fillRect(x - 1, yy + 3, 2, h - 6); g.globalAlpha = 1; }
      if (sel.has(n)) { g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.strokeRect(x - 8, yy - 3, Math.max(16, xe - x + 16), h + 6); }
    }
    // hover ghost
    if (hover && !drag && hover.L >= 0) {
      const draws = [hover.L]; if (hover.shift) draws.push(neighbourRow(hover.L, hover.upper));
      for (const L of draws) { const x = xOf(hover.t), y = lt + L * lh, h = lh * 0.56; g.strokeStyle = COLORS[L]; g.globalAlpha = 0.55; g.lineWidth = 1; g.strokeRect(x - 5.5, y + (lh - h) / 2 + 0.5, 11, h); g.globalAlpha = 1; }
    }
    // box select
    if (drag && drag.kind === 'box') { g.strokeStyle = '#ffffff'; g.setLineDash([4, 3]); g.strokeRect(Math.min(drag.x0, drag.x1), Math.min(drag.y0, drag.y1), Math.abs(drag.x1 - drag.x0), Math.abs(drag.y1 - drag.y0)); g.setLineDash([]); }
    // playhead
    const px = Math.round(xOf(now)) + 0.5;
    g.strokeStyle = BALL; g.lineWidth = 1.5; g.globalAlpha = 0.25; g.lineWidth = 6; g.beginPath(); g.moveTo(px, 0); g.lineTo(px, H); g.stroke();
    g.globalAlpha = 1; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = BALL; g.beginPath(); g.moveTo(px - 6, 0); g.lineTo(px + 6, 0); g.lineTo(px, 8); g.fill();
  }
  syncTimingFields(true);
  startLoop();

  // initial: detect BPM for a new chart, centre the view
  if (!chart.bpmSet) { chart.bpmSet = true; detect().then(save); }
  return async function close() {
    stopLoop(); ro.disconnect(); removeEventListener('keydown', onKey);
    if (dirty) await save();
    root.remove();
  };
}
