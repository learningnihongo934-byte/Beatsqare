// Shop (prize counter) and Profile screens.
import { $, $$, esc, toast, COLORS, DIR, idb, getSettings, fmtTime } from './util.js';
import { SLOTS, ITEMS, item, MiniScene, drawBall, drawTap, drawSide, drawBg, spawnHit, stepParts } from './cosmetics.js';
import { profile, owns, equipped, buy, equip, levelOf, ACH, daily, TOKEN, fmtTok, titleName } from './profile.js';
import { hitSound, ctx } from './audio.js';
import { DEMO_CHARTS } from './charts.js';

const eqNow = () => Object.fromEntries(['ball', 'trail', 'hit', 'note', 'frame', 'bg'].map(s => [s, equipped(s)]));

// static thumbnail for a card
function thumb(cv, it) {
  const g = cv.getContext('2d'), s = cv.width, X = s / 2, Y = s / 2, B = s * 0.3;
  g.fillStyle = '#07070d'; g.fillRect(0, 0, s, s);
  const slot = it.slot, eq = eqNow();
  if (slot === 'ball') drawBall(g, it.id, 'trail.none', [[X, Y]], s * 0.13, 0.6, null);
  else if (slot === 'trail') { const pts = Array.from({ length: 14 }, (_, i) => [X + s * 0.28 - i * s * 0.045, Y + Math.sin(i * 0.5) * s * 0.08]); drawBall(g, eq.ball, it.id, pts, s * 0.08, 0, []); }
  else if (slot === 'note') { for (const L of [0, 3]) drawTap(g, it.id, X, Y + s * 0.08, L, B * 1.15, B * 0.8, COLORS[L], 1); }
  else if (slot === 'frame') { for (let L = 0; L < 4; L++) drawSide(g, it.id, X, Y, B, L, COLORS[L], 2.2, 0.9, 0, 0); }
  else if (slot === 'bg') { const st = {}; for (let i = 0; i < 40; i++) drawBg(g, it.id, { X, Y, B: B * 0.6, W: s, H: s, dt: 1 / 30, state: st, newBeat: i % 8 === 0, bar: i % 32 === 0, beatLen: 0.27, pulse: 0.5, eLow: 0.4, eMid: 0.4, eHigh: 0.4 }); g.fillStyle = '#07070d'; g.globalAlpha = 0.0; }
  else if (slot === 'hit') { const parts = []; spawnHit(it.id, parts, X, Y + B, -Math.PI / 2, COLORS[0], 'perfect', B, true); for (let i = 0; i < 6; i++) stepParts(g, parts, 0.03); g.strokeStyle = COLORS[0]; g.lineWidth = 2; g.beginPath(); g.moveTo(X - B, Y + B); g.lineTo(X + B, Y + B); g.stroke(); }
  else if (slot === 'sound') { g.strokeStyle = COLORS[0]; g.fillStyle = COLORS[0]; g.lineWidth = 2; g.fillRect(X - s * 0.2, Y - s * 0.07, s * 0.1, s * 0.14); g.beginPath(); g.moveTo(X - s * 0.1, Y - s * 0.07); g.lineTo(X, Y - s * 0.17); g.lineTo(X, Y + s * 0.17); g.lineTo(X - s * 0.1, Y + s * 0.07); g.fill(); for (const r of [0.1, 0.18]) { g.beginPath(); g.arc(X + s * 0.02, Y, s * r, -0.8, 0.8); g.stroke(); } }
  else if (slot === 'theme') { const cs = it.colors || ['#19f0ff', '#ff2bd6', '#3dff7a', '#ffb020'], b = it.ball || '#fff6a0'; for (let L = 0; L < 4; L++) drawSide(g, 'frame.line', X, Y, B, L, cs[L], 2.4, 1, 0, 0); g.fillStyle = b; g.beginPath(); g.arc(X, Y, s * 0.05, 0, 7); g.fill(); }
  else if (slot === 'title') { g.strokeStyle = '#3a4562'; g.strokeRect(s * 0.1, Y - s * 0.12, s * 0.8, s * 0.24); g.fillStyle = '#e4ecf4'; g.font = `700 ${Math.round(s * 0.09)}px "Martian Mono", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(it.name.toUpperCase().slice(0, 12), X, Y); }
  g.globalAlpha = 1;
}

export function shop(app, bar) {
  let slot = 'ball', focus = equipped('ball'), raf = 0, scene = new MiniScene(eqNow()), last = performance.now();
  app.innerHTML = `${bar('#/shop')}<section class="shop">
    <aside class="shop-side frame" style="--c:var(--ball)">
      <div class="shop-bal"><span class="lbl">Tokens</span><span class="num" data-bal></span></div>
      <canvas class="shop-cv" width="480" height="480"></canvas>
      <div class="shop-info" data-info></div>
    </aside>
    <div class="shop-main">
      <div class="head" style="margin:0 0 12px"><h2 class="sec-title">Prize counter</h2><span class="lbl">Earn tokens by playing · everything is cosmetic</span></div>
      <div class="tabs shop-tabs" style="--c:var(--ball)">${SLOTS.map(([s, n]) => `<button data-slot="${s}" class="${s === slot ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="shop-grid" data-grid></div>
    </div></section>`;
  const cv = $('.shop-cv'), g = cv.getContext('2d');
  function renderGrid() {
    $('[data-grid]').innerHTML = ITEMS.filter(i => i.slot === slot).map(it => {
      const own = owns(it.id), on = equipped(it.slot) === it.id;
      const tag = on ? '<span class="st on">Equipped</span>' : own ? '<span class="st">Owned</span>' : it.ach ? `<span class="st lock">${esc(ACH.find(a => a.id === it.ach)?.name || 'Achievement')}</span>` : `<span class="st price">${TOKEN} ${fmtTok(it.price)}</span>`;
      return `<button class="shop-card ${it.id === focus ? 'sel' : ''} ${own ? 'own' : ''}" data-id="${it.id}"><canvas width="120" height="120"></canvas><b>${esc(it.name)}</b>${tag}</button>`;
    }).join('');
    $$('.shop-card').forEach(c => thumb(c.querySelector('canvas'), item(c.dataset.id)));
  }
  function renderInfo() {
    const it = item(focus), own = owns(focus), on = equipped(it.slot) === focus, P = profile();
    $('[data-bal]').innerHTML = `${TOKEN} ${fmtTok(P.tokens)}`;
    $('[data-info]').innerHTML = `<div class="lbl">${esc(SLOTS.find(s => s[0] === it.slot)[1])}</div><h3 class="disp" style="font-size:26px;margin:6px 0">${esc(it.name)}</h3><p class="muted" style="margin:0 0 14px">${esc(it.desc)}</p>
      ${on ? '<button class="btn" disabled>Equipped</button>' : own ? '<button class="btn pri" data-act="equip" style="--c:var(--down)">Equip</button>'
        : it.ach ? `<p class="lbl">Unlock: ${esc(ACH.find(a => a.id === it.ach)?.desc || '')}</p>`
        : `<button class="btn pri" data-act="buy" style="--c:var(--ball)" ${P.tokens < it.price ? 'disabled' : ''}>${TOKEN} Buy for ${fmtTok(it.price)}</button>${P.tokens < it.price ? `<p class="lbl" style="margin-top:8px">${fmtTok(it.price - P.tokens)} more tokens</p>` : ''}`}`;
  }
  function previewEq() {
    const eq = eqNow(), it = item(focus);
    if (['ball', 'trail', 'hit', 'note', 'frame', 'bg'].includes(it.slot)) eq[it.slot] = focus;
    return eq;
  }
  function loop(ts) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    const it = item(focus), saved = [...COLORS];
    if (it.slot === 'theme' && it.colors) it.colors.forEach((c, i) => (COLORS[i] = c));
    scene.eq = previewEq();
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#05050a'; g.fillRect(0, 0, 480, 480);
    scene.draw(g, { X: 240, Y: 240, B: 105, W: 480, H: 480 }, dt, null);
    if (it.slot === 'title' || true) { g.font = '600 13px "Martian Mono", monospace'; g.textAlign = 'center'; g.fillStyle = '#8a96ad'; g.fillText(`${(getSettings().handle || '').toUpperCase()} · ${(it.slot === 'title' ? it.name : titleName()).toUpperCase()}`, 240, 462); }
    saved.forEach((c, i) => (COLORS[i] = c));
  }
  raf = requestAnimationFrame(loop);
  const choose = id => { focus = id; $$('.shop-card').forEach(c => c.classList.toggle('sel', c.dataset.id === id)); renderInfo(); const it = item(id); if (it.slot === 'sound') { ctx(); [0, 1, 2, 3].forEach((L, i) => setTimeout(() => hitSound(L, 'tap', id), i * 180)); } };
  $('.shop-tabs').addEventListener('click', e => { const b = e.target.closest('[data-slot]'); if (!b) return; slot = b.dataset.slot; $$('.shop-tabs button').forEach(x => x.classList.toggle('on', x === b)); focus = equipped(slot); renderGrid(); renderInfo(); });
  $('[data-grid]').addEventListener('click', e => { const c = e.target.closest('.shop-card'); if (c) choose(c.dataset.id); });
  $('[data-info]').addEventListener('click', e => {
    const a = e.target.closest('[data-act]')?.dataset.act; if (!a) return;
    if (a === 'buy') { const r = buy(focus); if (r === 'ok') { equip(focus); toast(`Bought ${item(focus).name}`); } else if (r === 'poor') toast('Not enough tokens yet', true); }
    if (a === 'equip') { equip(focus); toast(`Equipped ${item(focus).name}`); }
    renderGrid(); renderInfo();
  });
  renderGrid(); renderInfo();
  return () => cancelAnimationFrame(raf);
}

export async function profileScreen(app, bar) {
  const P = profile(), s = P.stats, lv = levelOf(), S = getSettings();
  const charts = [...DEMO_CHARTS, ...(await idb.charts().catch(() => []))];
  const dl = daily(charts);
  const grades = ['SS', 'S', 'A', 'B', 'C', 'D'], gmax = Math.max(1, ...grades.map(x => s.grades[x] || 0));
  const got = ACH.filter(a => P.ach[a.id]).length;
  app.innerHTML = `${bar('#/profile')}<section class="page">
    <div class="span-12 pcard frame pad" style="--c:var(--up)">
      <div class="pc-lv"><span class="lbl">Level</span><span class="num">${lv.level}</span></div>
      <div class="pc-main">
        <div class="lbl">${esc(titleName())}</div>
        <h2 class="disp" style="font-size:clamp(30px,5vw,54px);margin:4px 0 10px">${esc(S.handle)}</h2>
        <div class="xpbar big"><i style="width:${(lv.into / lv.need * 100).toFixed(1)}%"></i></div>
        <div class="lbl">${fmtTok(lv.into)} / ${fmtTok(lv.need)} XP to level ${lv.level + 1}</div>
      </div>
      <div class="pc-tok"><span class="lbl">Tokens</span><span class="num">${TOKEN} ${fmtTok(P.tokens)}</span><a class="btn sm" href="#/shop" style="--c:var(--ball)">Prize counter</a></div>
    </div>
    <div class="span-7 frame pad" style="--c:var(--down)">
      <div class="head"><h3 class="sec-title" style="font-size:20px">Daily challenge</h3><span class="lbl">${new Date().toLocaleDateString()}</span></div>
      ${dl ? `<div class="daily ${dl.done ? 'done' : ''}"><div><b class="disp" style="font-size:22px">${esc(dl.title)}</b> <span class="badge diff-${esc(dl.difficulty)}">${esc(dl.difficulty)}</span><p style="margin:6px 0 0">${esc(dl.goal.text)}</p></div>
        <div class="daily-r">${dl.done ? '<span class="fc">Complete</span>' : `<span class="num">${TOKEN} +${dl.reward}</span><a class="btn pri" href="#/play/${encodeURIComponent(dl.chartId)}" style="--c:var(--down)">Play</a>`}</div></div>` : '<p class="muted">Add a chart with 30+ notes to get daily challenges.</p>'}
    </div>
    <div class="span-5 frame pad" style="--c:var(--left)">
      <div class="head"><h3 class="sec-title" style="font-size:20px">Recent</h3></div>
      ${(P.recent || []).length ? `<div class="board">${P.recent.map((r, i) => `<div><span class="dim">${i + 1}</span><span>${esc(r.title)} <span class="muted">${esc(r.difficulty)}</span></span><span>${esc(r.grade)}</span><span class="num">${fmtTok(r.score)}</span></div>`).join('')}</div>` : '<p class="muted">Play something.</p>'}
    </div>
    <div class="span-12 frame pad" style="--c:var(--right)">
      <div class="head"><h3 class="sec-title" style="font-size:20px">Lifetime</h3></div>
      <div class="pstats">
        ${[['Plays', s.plays], ['Clears', s.clears], ['Full combos', s.fcs], ['All perfects', s.aps], ['Notes hit', s.notes], ['Best combo', s.maxCombo], ['Time played', fmtTime(s.seconds)], ['Dailies', s.dailies]].map(([k, v]) => `<div><span class="lbl">${k}</span><span class="num">${typeof v === 'number' ? fmtTok(v) : v}</span></div>`).join('')}
      </div>
      <div class="gdist">${grades.map(x => `<div><span class="num">${x}</span><i style="height:${((s.grades[x] || 0) / gmax * 100).toFixed(0)}%"></i><span class="lbl">${s.grades[x] || 0}</span></div>`).join('')}</div>
    </div>
    <div class="span-12">
      <div class="head"><h3 class="sec-title" style="font-size:20px">Achievements</h3><span class="lbl">${got} / ${ACH.length}</span></div>
      <div class="achs">${ACH.map((a, i) => `<div class="ach ${P.ach[a.id] ? 'on' : ''}" style="--c:var(--${['up', 'right', 'down', 'left'][i % 4]})"><b>${esc(a.name)}</b><span>${esc(a.desc)}</span><em>${TOKEN} ${a.reward}${P.ach[a.id] ? ' · ' + new Date(P.ach[a.id]).toLocaleDateString() : ''}</em></div>`).join('')}</div>
    </div>
  </section>`;
}

export { eqNow };
