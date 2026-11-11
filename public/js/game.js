// Gameplay. Judging uses input timestamps mapped onto the audio output clock, so timing stays locked to the song.
import { ctx, Player, loadSong, hitSound, missSound, energy } from './audio.js';
import { DIR, COLORS, BALL, BAD, OPP, adjacent, getSettings, approachTime, setBest, getBest, api, esc, fmtNum, icon, clamp, $ } from './util.js';

// Tight windows (prototype: ±110 ms total, <50 ms = top grade)
export const WIN = { perfect: 0.040, great: 0.070, good: 0.110 };
const WEIGHT = { perfect: 1, great: 0.7, good: 0.4, miss: 0 };
const JCOL = { perfect: BALL, great: '#19f0ff', good: '#3dff7a', miss: BAD };
const KEYS = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };

export function gradeOf(acc, perfectAll) {
  if (perfectAll) return 'SS';
  return acc >= 95 ? 'S' : acc >= 90 ? 'A' : acc >= 80 ? 'B' : acc >= 70 ? 'C' : 'D';
}
export const chartKey = c => c.catalogId ? 'c:' + c.catalogId : (c.id || 'tmp');

export async function playChart(chart, opts = {}) {
  ctx();
  const S = getSettings();
  const root = document.createElement('div');
  root.className = 'game';
  root.innerHTML = `
    <canvas></canvas>
    <div class="prog"><i></i></div>
    <div class="hud">
      <div class="l"><div class="lbl">Score</div><div class="num glow" data-score>0</div></div>
      <div class="c"><div class="song">${esc(chart.title)} · <span class="diff-${esc(chart.difficulty)}">${esc(chart.difficulty)}</span>${opts.autoplay ? ' · <span style="color:var(--ball)">Autoplay</span>' : ''}</div></div>
      <div class="r"><div class="lbl">Accuracy</div><div class="num" data-acc>100.00%</div></div>
    </div>
    <button class="pause-btn" aria-label="Pause">${icon('pause')}</button>
    <div class="overlay" data-load><div class="panel" style="text-align:center"><div class="lbl">${chart.song.source === 'builtin' ? 'Building track' : 'Loading song'}</div><div class="num" style="font-size:40px" data-pct>0%</div></div></div>`;
  document.body.appendChild(root);
  document.body.classList.add('playing');
  const cv = root.querySelector('canvas'), g = cv.getContext('2d', { alpha: false });
  const hudScore = root.querySelector('[data-score]'), hudAcc = root.querySelector('[data-acc]'), prog = root.querySelector('.prog i');

  let buffer;
  try {
    buffer = await loadSong(chart.song, p => { const el = root.querySelector('[data-pct]'); if (el) el.textContent = p >= 0 ? Math.round(p * 100) + '%' : Math.round(-p / 1024) + ' KB'; });
  } catch (e) {
    root.querySelector('[data-load] .panel').innerHTML = `<div class="lbl" style="color:var(--bad)">Could not load the song</div><p>${esc(e.message)}</p><button class="btn" data-x>Back</button>`;
    return new Promise(res => root.querySelector('[data-x]').onclick = () => { cleanup(); res(null); });
  }
  root.querySelector('[data-load]').remove();

  const player = new Player(buffer);
  const beatLen = 60 / (chart.bpm || 120), beatOff = chart.offset || 0;
  const approach = approachTime();
  const startAt = Math.max(0, opts.start || 0);
  // notes (sorted), with per-note state
  const notes = chart.notes.map(n => ({ t: n.t, lane: n.lane, len: n.len || 0, pierce: n.type === 'pierce', st: 0, j: null, chord: false }))
    .filter(n => n.t >= startAt - 0.001).sort((a, b) => a.t - b.t || a.lane - b.lane);
  for (let i = 0; i < notes.length; i++) for (let k = i + 1; k < notes.length && notes[k].t - notes[i].t < 0.003; k++)
    if (adjacent(notes[i].lane, notes[k].lane)) { notes[i].chord = notes[k]; notes[k].chord = notes[i]; }
  const total = notes.reduce((s, n) => s + (n.len ? 2 : 1), 0) || 1;
  const lastT = notes.length ? Math.max(...notes.map(n => n.t + n.len)) : 0;
  const songEnd = Math.min(buffer.duration, Math.max(lastT + 2, startAt + 3));

  // stats
  const R = { perfect: 0, great: 0, good: 0, miss: 0, early: 0, late: 0, combo: 0, maxCombo: 0, sumW: 0, judged: 0 };

  // layout
  let W, H, dpr, X, Y, B, bloomA, bloomB, ga, gb;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    X = W / 2; Y = H / 2 + (H > W ? 10 : 0); B = Math.min(W, H) * (H > W ? 0.24 : 0.2);
    bloomA = Object.assign(document.createElement('canvas'), { width: Math.ceil(cv.width / 4), height: Math.ceil(cv.height / 4) });
    bloomB = Object.assign(document.createElement('canvas'), { width: Math.ceil(cv.width / 12), height: Math.ceil(cv.height / 12) });
    ga = bloomA.getContext('2d'); gb = bloomB.getContext('2d');
  }
  resize(); addEventListener('resize', resize);

  // ---------- input
  const keyHeld = [];             // lanes in press order (keyboard)
  const ptr = new Map();          // pointerId -> {x,y,lanes:[]}
  const auto = [];               // autoplay: [{lane, until}]
  const heldLanes = () => { const s = [...keyHeld, ...auto.map(a => a.lane)]; for (const p of ptr.values()) for (const l of p.lanes) { const i = s.indexOf(l); if (i >= 0) s.splice(i, 1); s.push(l); } return s; };
  function target() {
    const h = heldLanes(), a = h[h.length - 1], b = h[h.length - 2];
    if (a === undefined) return [0, 0];
    if (b !== undefined && adjacent(a, b)) return [DIR[a][0] + DIR[b][0], DIR[a][1] + DIR[b][1]];
    return DIR[a];
  }
  const active = L => { if (!heldLanes().includes(L)) return false; const [tx, ty] = target(); return tx * DIR[L][0] + ty * DIR[L][1] > 0.5; };
  let paused = false, ended = false, resumeGrace = -1;
  const offs = () => S.audioOffset / 1000;

  function press(L, perfMs) {
    if (paused || ended) return;
    const tp = player.timeAt(perfMs) - offs();
    let best = null;
    for (const n of notes) {
      if (n.t - tp > WIN.good) break;
      if (n.st === 0 && n.lane === L && Math.abs(n.t - tp) <= WIN.good) { best = n; break; }
    }
    if (!best) return;
    const d = tp - best.t, ad = Math.abs(d);
    const j = ad <= WIN.perfect ? 'perfect' : ad <= WIN.great ? 'great' : 'good';
    if (j !== 'perfect') d < 0 ? R.early++ : R.late++;
    judge(best, j, d);
    hitSound(L);
    if (best.len) best.st = 1; else best.st = 2;
  }
  function judge(n, j, d = 0, tail = false) {
    R[j]++; R.judged++; R.sumW += WEIGHT[j];
    if (j === 'miss') { R.combo = 0; shake = S.shake ? 9 : 0; flashSide(n.lane, BAD); missSound(); }
    else { R.combo++; R.maxCombo = Math.max(R.maxCombo, R.combo); flashSide(n.lane, j === 'perfect' ? '#ffffff' : COLORS[n.lane]); burst(n.lane, j); }
    pop = { j, d, life: 1, tail };
  }

  const onKey = e => {
    if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); if (!ended && !root.querySelector('[data-res]')) paused ? resume() : pause(); return; }
    const L = KEYS[e.code]; if (L === undefined) return;
    e.preventDefault();
    if (e.repeat || opts.autoplay) return;
    if (!keyHeld.includes(L)) keyHeld.push(L);
    press(L, e.timeStamp);
  };
  const onKeyUp = e => { const L = KEYS[e.code]; if (L === undefined) return; const i = keyHeld.indexOf(L); if (i >= 0) keyHeld.splice(i, 1); };
  // touch / mouse: swipe from the touch point; diagonal = corner; drag back toward the start = release (re-swipe without lifting)
  const SW = 22;
  const swipeLanes = (dx, dy) => {
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.hypot(dx, dy) < SW) return [];
    const h = dx > 0 ? 1 : 3, v = dy > 0 ? 2 : 0;
    return ax > ay * 2 ? [h] : ay > ax * 2 ? [v] : [h, v];
  };
  const onPDown = e => {
    if (opts.autoplay || e.target.closest('.pause-btn,.overlay')) return;
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, lanes: [] });
    try { cv.setPointerCapture(e.pointerId); } catch {}
  };
  const onPMove = e => {
    const p = ptr.get(e.pointerId); if (!p) return;
    const ln = swipeLanes(e.clientX - p.x, e.clientY - p.y);
    const added = ln.filter(l => !p.lanes.includes(l));
    if (ln.length === 0 && p.lanes.length) { p.lanes = []; return; }
    if (!added.length && ln.length === p.lanes.length) return;
    // re-anchor once a direction is chosen so the next flick reads from here
    p.lanes = ln;
    for (const l of added) press(l, e.timeStamp);
  };
  const onPUp = e => { ptr.delete(e.pointerId); };
  addEventListener('keydown', onKey); addEventListener('keyup', onKeyUp);
  cv.addEventListener('pointerdown', onPDown); addEventListener('pointermove', onPMove); addEventListener('pointerup', onPUp); addEventListener('pointercancel', onPUp);
  const onVis = () => { if (document.hidden && !paused && !ended) pause(); };
  document.addEventListener('visibilitychange', onVis);
  const onBlur = () => { keyHeld.length = 0; ptr.clear(); };
  addEventListener('blur', onBlur);
  root.querySelector('.pause-btn').onclick = () => { if (!root.querySelector('[data-res]')) paused ? resume() : pause(); };

  // ---------- fx state
  const ball = { x: 0, y: 0 }, trail = [];
  const sideFlash = [0, 0, 0, 0], sideCol = ['#fff', '#fff', '#fff', '#fff'];
  const parts = []; let shake = 0, pop = null, rings = [], lastBeat = -1;
  function flashSide(L, col) { sideFlash[L] = 1; sideCol[L] = col; }
  function burst(L, j) {
    if (!S.particles) return;
    const [dx, dy] = DIR[L], cnt = j === 'perfect' ? 18 : 10;
    const bx = X + dx * B + (dy ? ball.x * B * 0.7 : 0), by = Y + dy * B + (dx ? ball.y * B * 0.7 : 0);
    for (let i = 0; i < cnt && parts.length < 400; i++) {
      const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 2.2, sp = 120 + Math.random() * 420;
      parts.push({ x: bx + (dy ? (Math.random() - 0.5) * B : 0), y: by + (dx ? (Math.random() - 0.5) * B : 0), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, c: Math.random() < 0.3 ? '#fff' : COLORS[L], s: 1 + Math.random() * 2.5 });
    }
  }

  // ---------- flow
  const firstT = notes.length ? notes[0].t : 0;
  const lead = Math.max(1.0, approach + 0.8 - (firstT - startAt));
  const beginPos = startAt > 0 ? Math.max(-lead, startAt - 2) : -lead;
  if (chart.catalogId && !opts.playtest && !opts.autoplay) api('/charts/' + chart.catalogId + '/play', { method: 'POST', body: '{}' }).catch(() => {});

  if (localStorage.getItem('bsq.debug')) window.__bsqGame = { player, notes, R, pause, resume, get paused() { return paused; } };
  let resolveDone;
  const done = new Promise(r => (resolveDone = r));
  player.play(beginPos, 1, 0.05);

  function pause() {
    if (paused || ended) return;
    paused = true; player.stop();
    const ov = document.createElement('div');
    ov.className = 'overlay'; ov.dataset.pause = '1';
    ov.innerHTML = `<div class="panel frame pad" style="--c:var(--up)">
      <div class="head"><h2 class="sec-title">Paused</h2><span class="lbl">${esc(chart.title)}</span></div>
      <div class="menu-list">
        <button class="btn" data-a="resume">Resume <span class="keycap">Esc</span></button>
        <button class="btn" data-a="restart" style="--c:var(--left)">Restart</button>
        <button class="btn" data-a="quit" style="--c:var(--right)">${opts.playtest ? 'Back to editor' : 'Quit'}</button>
      </div></div>`;
    root.appendChild(ov);
    ov.onclick = e => { const a = e.target.closest('[data-a]')?.dataset.a; if (a === 'resume') resume(); if (a === 'restart') { finish(null, 'restart'); } if (a === 'quit') finish(null, 'quit'); };
    ov.querySelector('[data-a=resume]').focus();
  }
  function resume() {
    if (!paused) return;
    root.querySelector('[data-pause]')?.remove();
    const pos = player.startPos;
    resumeGrace = pos + 0.25;
    player.play(Math.max(beginPos, pos - 2), 1, 0.05);
    countdownTo = pos;
    paused = false;
  }
  let countdownTo = -1;

  function finish(result, action) {
    if (ended) return; ended = true;
    player.stop();
    cleanup();
    resolveDone({ result, action });
  }
  function cleanup() {
    removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp); removeEventListener('resize', resize);
    removeEventListener('pointermove', onPMove); removeEventListener('pointerup', onPUp); removeEventListener('pointercancel', onPUp);
    removeEventListener('blur', onBlur); document.removeEventListener('visibilitychange', onVis);
    cancelAnimationFrame(raf); root.remove(); document.body.classList.remove('playing');
  }

  // ---------- main loop
  let raf, lastTs = performance.now(), shownScore = -1, shownAcc = '';
  const scoreNow = () => Math.round(900000 * R.sumW / total + 100000 * R.maxCombo / total);
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - lastTs) / 1000); lastTs = ts;
    const now = player.time();
    const judgeNow = now - offs();
    if (!paused && !ended) {
      if (opts.autoplay) {
        for (const n of notes) {
          if (n.t > judgeNow) break;
          if (n.st !== 0) continue;
          n.st = n.len ? 1 : 2; judge(n, 'perfect'); hitSound(n.lane);
          auto.push({ lane: n.lane, until: n.t + n.len + 0.07 });
        }
        for (let i = auto.length - 1; i >= 0; i--) if (auto[i].until <= judgeNow) auto.splice(i, 1);
      }
      // misses and holds
      for (const n of notes) {
        if (n.t > judgeNow + WIN.good) break;
        if (n.st === 0 && judgeNow - n.t > WIN.good) { n.st = 3; judge(n, 'miss'); if (n.len) { judge(n, 'miss', 0, true); } }
        else if (n.st === 1) {
          const end = n.t + n.len;
          if (judgeNow >= end) { n.st = 2; judge(n, 'perfect', 0, true); hitSound(n.lane, 'end'); }
          else if (!active(n.lane) && judgeNow < end - 0.09 && judgeNow > resumeGrace) { n.st = 4; judge(n, 'miss', 0, true); }
        }
      }
      if (now >= songEnd || !player.playing) showResults();
    }
    // ball: near-instant ease toward target (prototype k = 45)
    const [tx, ty] = target(), k = 1 - Math.exp(-dt * 45);
    ball.x += (tx - ball.x) * k; ball.y += (ty - ball.y) * k;
    trail.unshift([ball.x, ball.y]); if (trail.length > 7) trail.pop();
    draw(now - S.visualOffset / 1000, dt);
    // hud
    const sc = scoreNow();
    if (sc !== shownScore) { shownScore = sc; hudScore.textContent = fmtNum(sc).padStart(7, '0'); }
    const acc = (R.judged ? R.sumW / R.judged * 100 : 100).toFixed(2) + '%';
    if (acc !== shownAcc) { shownAcc = acc; hudAcc.textContent = acc; }
    prog.style.width = clamp((now - startAt) / Math.max(1, songEnd - startAt), 0, 1) * 100 + '%';
  }
  raf = requestAnimationFrame(frame);

  function sideLine(L, ext = 0) {
    const [dx, dy] = DIR[L];
    g.beginPath();
    if (dx) { g.moveTo(X + dx * B, Y - B - ext); g.lineTo(X + dx * B, Y + B + ext); }
    else { g.moveTo(X - B - ext, Y + dy * B); g.lineTo(X + B + ext, Y + dy * B); }
  }
  function glowStroke(col, w, a = 1) {
    g.strokeStyle = col; g.globalAlpha = a * 0.25; g.lineWidth = w * 3.2; g.stroke();
    g.globalAlpha = a; g.lineWidth = w; g.stroke(); g.globalAlpha = 1;
  }

  function draw(now, dt) {
    const [eLow, eMid, eHigh] = energy();
    const bp = ((now - beatOff) / beatLen), beatIdx = Math.floor(bp), phase = bp - beatIdx;
    const pulse = now > 0 ? Math.exp(-phase * 5) : 0;
    if (beatIdx !== lastBeat && now > 0) { lastBeat = beatIdx; rings.push({ s: 1, a: beatIdx % 4 === 0 ? 1 : 0.55 }); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#05050a'; g.fillRect(0, 0, W, H);
    shake *= Math.exp(-dt * 14);
    const sx = shake > 0.3 ? (Math.random() - 0.5) * shake : 0, sy = shake > 0.3 ? (Math.random() - 0.5) * shake : 0;
    g.translate(sx, sy);
    g.lineCap = 'square';
    // background: tunnel rails + expanding beat rings (reacts to bass/mid)
    const far = Math.hypot(W, H) / 2;
    g.strokeStyle = '#1b2236'; g.lineWidth = 1; g.globalAlpha = 0.6 + eMid * 0.8;
    g.beginPath();
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.moveTo(X + cx * B, Y + cy * B); g.lineTo(X + cx * far, Y + cy * far); }
    g.stroke(); g.globalAlpha = 1;
    for (const r of rings) {
      r.s += dt * 1.6 / beatLen * 0.5 * (1 + r.s * 0.6);
      const s = B * r.s, a = r.a * Math.max(0, 1 - (r.s - 1) / 4) * (0.25 + eLow * 1.1);
      if (a <= 0.01) continue;
      g.strokeStyle = '#3a4c7a'; g.globalAlpha = Math.min(0.9, a); g.lineWidth = 1.5;
      g.strokeRect(X - s, Y - s, s * 2, s * 2);
    }
    g.globalAlpha = 1;
    rings = rings.filter(r => r.s < 5);
    // lane guides
    g.setLineDash([3, 9]); g.lineWidth = 1;
    for (let L = 0; L < 4; L++) {
      const [dx, dy] = DIR[L];
      g.strokeStyle = COLORS[L]; g.globalAlpha = 0.14 + eHigh * 0.25;
      g.beginPath(); g.moveTo(X + dx * B, Y + dy * B); g.lineTo(X + dx * (dx ? W / 2 : 0), Y + dy * (dy ? H / 2 : 0)); g.stroke();
    }
    g.setLineDash([]); g.globalAlpha = 1;
    // combo watermark in the box
    if (R.combo >= 2) {
      g.font = `800 ${Math.round(B * 0.62)}px Tourney, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#ffffff'; g.globalAlpha = 0.07 + pulse * 0.05; g.fillText(R.combo, X, Y + B * 0.04); g.globalAlpha = 1;
    }
    // box sides (pulse on the beat, flash on hit/miss, thicken when active)
    for (let L = 0; L < 4; L++) {
      const act = active(L);
      sideLine(L, 0);
      glowStroke(COLORS[L], 3 + pulse * 1.5 + (act ? 2 : 0), 0.75 + pulse * 0.25);
      if (sideFlash[L] > 0.01) { sideLine(L, 6 * sideFlash[L]); glowStroke(sideCol[L], 3 + 7 * sideFlash[L], sideFlash[L]); sideFlash[L] *= Math.exp(-dt * 9); }
    }
    // corner ticks
    g.strokeStyle = '#e4ecf4'; g.lineWidth = 1.5; g.globalAlpha = 0.5;
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const px = X + cx * (B + 10), py = Y + cy * (B + 10); g.beginPath(); g.moveTo(px - cx * 8, py); g.lineTo(px, py); g.lineTo(px, py - cy * 8); g.stroke(); }
    g.globalAlpha = 1;
    // notes
    const farOf = L => (DIR[L][0] ? W / 2 : H / 2) + 20;
    const maxLook = approach * (1 + 2 * B / (Math.min(W, H) / 2 + 20 - B));
    for (const n of notes) {
      if (n.t - now > maxLook) break;
      const sp = (farOf(n.pierce ? OPP[n.lane] : n.lane) - B) / approach;
      const lookahead = n.pierce ? approach + 2 * B / sp : approach;
      if (n.t - now > lookahead) continue;
      if (n.st === 2 && !n.len) continue;
      if (n.st === 3 && now - n.t > 0.25) continue;
      if ((n.st === 2 || n.st === 4) && now > n.t + n.len + 0.1) continue;
      const L = n.lane, [dx, dy] = DIR[L], col = COLORS[L];
      const missed = n.st === 3 || n.st === 4;
      const dist = t => B + 8 + Math.max(0, t - now) * sp;
      if (n.len) {
        const headD = n.st === 1 ? B + 8 : dist(n.t), endD = Math.min(farOf(L), dist(n.t + n.len)), w = B * 0.3;
        if (endD > headD) {
          g.globalAlpha = missed ? 0.15 : n.st === 1 ? 0.55 : 0.32; g.fillStyle = col;
          if (dx) g.fillRect(dx > 0 ? X + headD : X - endD, Y - w / 2, endD - headD, w);
          else g.fillRect(X - w / 2, dy > 0 ? Y + headD : Y - endD, w, endD - headD);
          g.globalAlpha = missed ? 0.2 : 0.9; g.strokeStyle = col; g.lineWidth = 1.5;
          if (dx) g.strokeRect(dx > 0 ? X + headD : X - endD, Y - w / 2, endD - headD, w);
          else g.strokeRect(X - w / 2, dy > 0 ? Y + headD : Y - endD, w, endD - headD);
          g.globalAlpha = 1;
        }
        if (n.st === 2 || n.st === 4) continue;
      }
      if (n.pierce) {
        // travels from the opposite edge, through the box, and lands on side L at time t
        const D = Math.max(0, n.t - now) * sp, px = X + dx * (B - D), py = Y + dy * (B - D), hw = B * 0.5;
        g.strokeStyle = col; g.lineWidth = 2.5; g.globalAlpha = missed ? 0.3 : 1;
        g.beginPath();
        if (dx) { g.moveTo(px - dx * 5, py - hw); g.lineTo(px - dx * 5, py + hw); g.moveTo(px + dx * 3, py - hw); g.lineTo(px + dx * 3, py + hw); g.moveTo(px - dx * 16, py - 10); g.lineTo(px - dx * 6, py); g.lineTo(px - dx * 16, py + 10); }
        else { g.moveTo(px - hw, py - dy * 5); g.lineTo(px + hw, py - dy * 5); g.moveTo(px - hw, py + dy * 3); g.lineTo(px + hw, py + dy * 3); g.moveTo(px - 10, py - dy * 16); g.lineTo(px, py - dy * 6); g.lineTo(px + 10, py - dy * 16); }
        glowStroke(col, 2.5, missed ? 0.3 : 1);
        continue;
      }
      const d = n.st === 1 ? B + 8 : dist(n.t), hw = B * 0.56, th = 7;
      g.globalAlpha = missed ? 0.3 : 1;
      g.fillStyle = col;
      if (dx) g.fillRect(X + dx * d - th / 2, Y - hw, th, hw * 2); else g.fillRect(X - hw, Y + dy * d - th / 2, hw * 2, th);
      g.fillStyle = '#ffffff'; g.globalAlpha = missed ? 0.15 : 0.7;
      if (dx) g.fillRect(X + dx * d - 1, Y - hw + 2, 2, hw * 2 - 4); else g.fillRect(X - hw + 2, Y + dy * d - 1, hw * 2 - 4, 2);
      g.globalAlpha = 1;
      // chord bracket: dashed white link between the two notes' near ends
      if (n.chord && n.lane < n.chord.lane && n.st === 0 && n.chord.st === 0) {
        const m = n.chord, [mx, my] = DIR[m.lane];
        const ax = dx ? X + dx * d : X + mx * hw, ay = dy ? Y + dy * d : Y + my * hw;
        const bx2 = mx ? X + mx * d : X + dx * hw, by2 = my ? Y + my * d : Y + dy * hw;
        g.setLineDash([4, 4]); g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.globalAlpha = 0.8;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(dx ? ax : bx2, dx ? by2 : ay); g.lineTo(bx2, by2); g.stroke();
        g.setLineDash([]); g.globalAlpha = 1;
      }
    }
    // ball with short motion trail
    const r = B * 0.085, reach = B - r - 6;
    for (let i = trail.length - 1; i >= 1; i--) {
      const [tx2, ty2] = trail[i]; g.globalAlpha = (1 - i / trail.length) * 0.25; g.fillStyle = BALL;
      g.beginPath(); g.arc(X + tx2 * reach, Y + ty2 * reach, r * (1 - i / 10), 0, 7); g.fill();
    }
    g.globalAlpha = 0.3; g.beginPath(); g.arc(X + ball.x * reach, Y + ball.y * reach, r * 2.2, 0, 7); g.fill();
    g.globalAlpha = 1; g.fillStyle = '#fffbe0'; g.beginPath(); g.arc(X + ball.x * reach, Y + ball.y * reach, r, 0, 7); g.fill();
    // particles (additive)
    g.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; p.life -= dt * 2.4;
      if (p.life <= 0) continue;
      g.globalAlpha = p.life; g.fillStyle = p.c; g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // judgement pop
    if (pop && pop.life > 0) {
      const txt = pop.j.toUpperCase(), s = 1 + (1 - pop.life) * 0.15 + (pop.life > 0.85 ? (pop.life - 0.85) * 2 : 0);
      g.font = `800 ${Math.round(Math.max(16, B * 0.15) * s)}px Tourney, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.globalAlpha = Math.min(1, pop.life * 2); g.fillStyle = JCOL[pop.j];
      g.fillText(txt, X, Y - B * 0.5);
      if (pop.j === 'great' || pop.j === 'good') { g.font = `500 ${Math.round(Math.max(9, B * 0.06))}px "Martian Mono", monospace`; g.fillStyle = '#8a96ad'; g.fillText(pop.d < 0 ? 'EARLY' : 'LATE', X, Y - B * 0.33); }
      g.globalAlpha = 1; pop.life -= dt * 2;
    }
    // countdown after resume / lead-in
    const cdT = countdownTo > 0 && now < countdownTo ? countdownTo - now : now < 0 ? -now : 0;
    if (cdT > 0.05 && cdT < 3.5) {
      g.font = `900 ${Math.round(B * 0.5)}px Tourney, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = BALL; g.globalAlpha = 0.9 * (cdT % 1); g.fillText(Math.ceil(cdT), X, Y + B * 0.5); g.globalAlpha = 1;
    } else if (countdownTo > 0 && now >= countdownTo) countdownTo = -1;
    // bloom: downsample twice and add back (cheap, no shadowBlur)
    if (S.crt) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      ga.globalCompositeOperation = 'copy'; ga.drawImage(cv, 0, 0, bloomA.width, bloomA.height);
      gb.globalCompositeOperation = 'copy'; gb.drawImage(bloomA, 0, 0, bloomB.width, bloomB.height);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.45; g.drawImage(bloomA, 0, 0, cv.width, cv.height);
      g.globalAlpha = 0.55 + pulse * 0.15; g.drawImage(bloomB, 0, 0, cv.width, cv.height);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
  }

  // ---------- results
  async function showResults() {
    if (ended || root.querySelector('[data-res]')) return;
    paused = true; player.stop();
    const counted = R.perfect + R.great + R.good + R.miss;
    const acc = counted ? R.sumW / counted * 100 : 0;
    const fc = R.miss === 0 && counted > 0, ap = fc && R.great === 0 && R.good === 0;
    const score = scoreNow(), grade = gradeOf(acc, ap);
    const result = { score, acc: +acc.toFixed(2), grade, fc, maxCombo: R.maxCombo, ...R };
    const key = chartKey(chart), prevBest = getBest(key);
    const isBest = !opts.playtest && !opts.autoplay && startAt === 0 && setBest(key, result);
    const ov = document.createElement('div');
    ov.className = 'overlay'; ov.dataset.res = '1';
    const gcol = { SS: BALL, S: BALL, A: '#19f0ff', B: '#3dff7a', C: '#ffb020', D: BAD }[grade];
    ov.innerHTML = `<div class="res-grid">
      <div class="res-main frame pad" style="--c:${gcol}">
        <div class="head"><span class="lbl">${opts.autoplay ? 'Autoplay · not scored' : opts.playtest ? 'Playtest' : 'Stage clear'}</span><span class="lbl">${esc(chart.title)} · ${esc(chart.difficulty)}</span></div>
        <div style="display:flex;align-items:flex-end;gap:24px;flex-wrap:wrap">
          <div class="res-grade glow" style="color:${gcol}">${grade}</div>
          <div><div class="lbl">Score${isBest ? ' · <span style="color:var(--ball)">New best</span>' : ''}</div><div class="num" style="font-size:44px">${fmtNum(score).padStart(7, '0')}</div>
          <div class="row" style="margin-top:8px">${ap ? '<span class="fc">All perfect</span>' : fc ? '<span class="fc">Full combo</span>' : ''}<span class="muted">${acc.toFixed(2)}% · ${R.maxCombo}x max combo</span></div></div>
        </div>
        <div class="judges">
          <div><span class="lbl">Perfect</span><span class="num" style="color:var(--ball)">${R.perfect}</span></div>
          <div><span class="lbl">Great</span><span class="num c-up">${R.great}</span></div>
          <div><span class="lbl">Good</span><span class="num c-down">${R.good}</span></div>
          <div><span class="lbl">Miss</span><span class="num" style="color:var(--bad)">${R.miss}</span></div>
        </div>
        <p class="muted" style="font-size:11px;margin:12px 0 0">Early ${R.early} · Late ${R.late}${prevBest && !isBest ? ` · Best ${fmtNum(prevBest.score)} (${prevBest.grade})` : ''}${R.early + R.late > 8 && Math.abs(R.early - R.late) > (R.early + R.late) * 0.5 ? ` · You hit ${R.early > R.late ? 'early' : 'late'} a lot — try the calibration in Settings` : ''}</p>
        <div class="row" style="margin-top:20px">
          <button class="btn pri" data-a="retry" style="--c:var(--up)">Retry</button>
          <button class="btn" data-a="quit">${opts.playtest ? 'Back to editor' : 'Song select'}</button>
          ${opts.editable && !opts.playtest ? `<button class="btn" data-a="edit" style="--c:var(--left)">${icon('edit')}Edit chart</button>` : ''}
        </div>
      </div>
      <div class="res-side frame pad" style="--c:var(--right)">
        <div class="head"><span class="sec-title" style="font-size:20px">Leaderboard</span></div>
        <div class="board" data-board>${chart.catalogId && !opts.playtest && !opts.autoplay ? '<p class="muted">Sending score…</p>' : '<p class="muted">Publish this chart to the catalog to get an online leaderboard.</p>'}</div>
      </div></div>`;
    root.appendChild(ov);
    ov.onclick = e => { const a = e.target.closest('[data-a]')?.dataset.a; if (a) finish(result, a === 'retry' ? 'restart' : a); };
    ov.querySelector('[data-a=retry]').focus();
    if (chart.catalogId && !opts.playtest && !opts.autoplay && startAt === 0) {
      try {
        const { scores } = await api('/charts/' + chart.catalogId + '/scores', { method: 'POST', body: JSON.stringify({ handle: S.handle, score, acc: result.acc, combo: R.maxCombo, grade, fc }) });
        const b = ov.querySelector('[data-board]');
        b.innerHTML = scores.length ? scores.map((s, i) => `<div class="${s.handle === S.handle ? 'me' : ''}"><span class="dim">${i + 1}</span><span>${esc(s.handle)}</span><span>${esc(s.grade)}${s.fc ? ' FC' : ''}</span><span class="num">${fmtNum(s.score)}</span></div>`).join('') : '<p class="muted">No scores yet.</p>';
      } catch (e) { ov.querySelector('[data-board]').innerHTML = `<p class="muted">Leaderboard offline: ${esc(e.message)}</p>`; }
    }
  }

  return done;
}
