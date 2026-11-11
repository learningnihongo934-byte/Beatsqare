// Song select: song wheel on the right (one row per song), jacket + difficulty tabs + chart graph on the left.
import { songKey } from './audio.js';
import { $, $$, esc, icon, toast, idb, getBest, fmtTime, fmtNum, clamp, uid, downloadText, slug, COLORS, DIFFS } from './util.js';
import { DEMO_CHARTS, importChartFile } from './charts.js';
import { chartKey } from './game.js';
import { exportPack, downloadBytes } from './pack.js';
import { preview } from './music.js';

const DCOL = { Easy: 'down', Normal: 'up', Hard: 'left', Expert: 'right' };
const GRADE_RANK = { SS: 6, S: 5, A: 4, B: 3, C: 2, D: 1 };
const baseTitle = t => String(t || 'Untitled').replace(/ \((edit|my chart|auto)\)$/, '');
const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export function credit(song) {
  if (!song) return '';
  if (song.source === 'builtin') return 'Original track, synthesized in your browser.';
  const lic = esc(song.license || ''), who = esc(song.credit || '');
  if (song.source === 'audius') return `Song by <b>${who}</b> · ${lic} · via ${song.link ? `<a href="${esc(song.link)}" target="_blank" rel="noopener">Audius</a>` : 'Audius'}`;
  return `Song: ${who || 'your file'}${lic ? ' · ' + lic : ''}`;
}

async function songGroups() {
  const mine = await idb.charts().catch(() => []);
  const map = new Map();
  for (const c of [...DEMO_CHARTS, ...mine]) {
    const k = songKey(c.song);
    if (!map.has(k)) map.set(k, { key: k, song: c.song, title: baseTitle(c.title), artist: c.artist || c.song.credit || '', bpm: c.bpm, offset: c.offset || 0, duration: c.duration, charts: [], added: 0 });
    const g = map.get(k);
    g.charts.push(c); g.added = Math.max(g.added, c.updated || c.downloaded || c.created || 0);
    if (c.song.art && !g.song.art) g.song = c.song;
  }
  for (const g of map.values()) {
    g.charts.sort((a, b) => DIFFS.indexOf(a.difficulty) - DIFFS.indexOf(b.difficulty) || (a.level || 0) - (b.level || 0) || (a.builtin ? -1 : 1));
    g.best = g.charts.map(c => getBest(chartKey(c))).filter(Boolean).sort((a, b) => GRADE_RANK[b.grade] - GRADE_RANK[a.grade])[0] || null;
    g.maxLevel = Math.max(...g.charts.map(c => c.level || 0));
  }
  return [...map.values()];
}

// Generated jacket: concentric squares seeded by the title, big initials, the ball.
function jacket(g) {
  if (g.song.art) return `<div class="jk-art" style="background-image:url('${esc(g.song.art)}')"></div>`;
  const h = hash(g.title), rnd = i => ((h >>> (i * 3)) & 7) / 7;
  let sq = '';
  for (let i = 0; i < 7; i++) {
    const s = 18 + i * 13 + rnd(i) * 6, o = (100 - s) / 2 + (rnd(i + 2) - 0.5) * 8, col = COLORS[(h + i) % 4];
    sq += `<rect x="${o.toFixed(1)}" y="${(100 - s) / 2}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" fill="none" stroke="${col}" stroke-width="${i === 0 ? 1.4 : 0.5}" opacity="${(1 - i * 0.11).toFixed(2)}"/>`;
  }
  const initials = g.title.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return `<svg class="jk-svg" viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" fill="#07070d"/>${sq}
    <text x="50" y="55" text-anchor="middle" dominant-baseline="middle" font-family="Tourney" font-weight="900" font-size="30" fill="none" stroke="#e4ecf4" stroke-width="0.6" letter-spacing="1">${esc(initials)}</text>
    <circle cx="50" cy="${70 + rnd(9) * 8}" r="2.2" fill="#fff6a0"/></svg>`;
}

function graph(c) {
  const n = 64, d = c.duration || (c.notes.length ? c.notes[c.notes.length - 1].t + 2 : 60);
  const bins = Array.from({ length: n }, () => [0, 0, 0, 0]);
  for (const x of c.notes) bins[Math.min(n - 1, Math.max(0, Math.floor(x.t / d * n)))][x.lane]++;
  const mx = Math.max(1, ...bins.map(b => b[0] + b[1] + b[2] + b[3]));
  let s = '';
  bins.forEach((b, i) => { let y = 48; for (let L = 0; L < 4; L++) { const hh = b[L] / mx * 44; if (hh > 0.2) { y -= hh; s += `<rect x="${i * 5 + 0.5}" y="${y.toFixed(1)}" width="3.6" height="${hh.toFixed(1)}" fill="${COLORS[L]}"/>`; } } });
  const peak = (mx / (d / n)).toFixed(1);
  return `<svg viewBox="0 0 320 48" preserveAspectRatio="none" class="ss-graph">${s}</svg>
    <div class="ss-axis"><span>0:00</span><span>peak ${peak} notes/s</span><span>${fmtTime(d)}</span></div>`;
}

export async function songSelect(app, bar, nav, selId) {
  let groups = await songGroups();
  let q = '', sort = 'new', gi = 0, ci = 0;
  const sel = decodeURIComponent(selId || '');
  const sorters = {
    new: (a, b) => (a.charts[0].builtin ? 1 : 0) - (b.charts[0].builtin ? 1 : 0) || b.added - a.added,
    az: (a, b) => a.title.localeCompare(b.title),
    level: (a, b) => b.maxLevel - a.maxLevel,
  };
  let view = [];
  function filter() {
    const s = q.toLowerCase();
    view = groups.filter(g => !s || (g.title + ' ' + g.artist).toLowerCase().includes(s)).sort(sorters[sort]);
  }
  filter();
  if (sel) { const i = view.findIndex(g => g.charts.some(c => c.id === sel)); if (i >= 0) { gi = i; ci = view[i].charts.findIndex(c => c.id === sel); } }

  app.innerHTML = `${bar('#/library')}<section class="ss">
    <div class="ss-detail" data-detail></div>
    <div class="ss-wheel">
      <div class="ss-tools">
        <input class="input" data-q placeholder="Search songs  ( / )" autocomplete="off" aria-label="Search songs">
        <div class="seg" data-sort style="--c:var(--right)"><button data-v="new" class="on">Recent</button><button data-v="az">A–Z</button><button data-v="level">Level</button></div>
      </div>
      <div class="ss-list" data-list role="listbox" aria-label="Songs"></div>
      <div class="ss-foot"><span class="lbl" data-count></span>
        <label class="btn sm">${icon('up')}Import .bsq / JSON<input type="file" accept=".bsq,.json,application/json" multiple hidden data-imp></label>
        <a class="btn sm" href="#/create">New chart</a><a class="btn sm" href="#/catalog">Catalog</a></div>
    </div></section>`;
  const list = $('[data-list]'), det = $('[data-detail]');

  function renderList() {
    $('[data-count]').textContent = `${view.length} song${view.length === 1 ? '' : 's'} · ${view.reduce((s, g) => s + g.charts.length, 0)} charts`;
    list.innerHTML = view.length ? view.map((g, i) => {
      const pips = DIFFS.map(d => { const c = g.charts.find(x => x.difficulty === d); if (!c) return `<i class="pip off"></i>`; const b = getBest(chartKey(c)); return `<i class="pip ${b ? 'done' : ''}" style="--c:var(--${DCOL[d]})" title="${d} ${c.level || ''}"></i>`; }).join('');
      return `<button class="ss-row ${i === gi ? 'on' : ''}" data-i="${i}" role="option" aria-selected="${i === gi}" style="--c:var(--${['up', 'right', 'down', 'left'][hash(g.key) % 4]})">
        <span class="ss-n">${String(i + 1).padStart(2, '0')}</span>
        <span class="ss-t"><b>${esc(g.title)}</b><i>${esc(g.artist || '—')}</i></span>
        <span class="ss-pips">${pips}</span>
        <span class="ss-g">${g.best ? esc(g.best.grade) : ''}</span></button>`;
    }).join('') : `<div class="empty">No songs match “${esc(q)}”.</div>`;
  }
  function renderDetail() {
    const g = view[gi];
    if (!g) { det.innerHTML = ''; return; }
    ci = clamp(ci, 0, g.charts.length - 1);
    const c = g.charts[ci], best = getBest(chartKey(c)), own = !c.builtin && !c.id.startsWith('cat-');
    const nps = c.notes.length / Math.max(1, c.duration || 1);
    det.style.setProperty('--c', `var(--${DCOL[c.difficulty] || 'up'})`);
    det.innerHTML = `
      <div class="ss-top">
        <div class="jk">${jacket(g)}<span class="jk-bpm">${+(+c.bpm).toFixed(1)} BPM</span></div>
        <div class="ss-meta">
          <div class="lbl">${g.charts[0].builtin ? 'Built-in' : g.song.source === 'audius' ? 'Audius' : g.song.source === 'upload' ? 'Uploaded' : 'On this device'} · ${fmtTime(c.duration)}</div>
          <h2 class="disp ss-title">${esc(g.title)}</h2>
          <div class="muted">${esc(g.artist || 'Unknown artist')}</div>
          <p class="credit">${credit(g.song)}</p>
        </div>
      </div>
      <div class="ss-diffs" role="tablist">${g.charts.map((x, i) => { const b = getBest(chartKey(x)); return `<button class="ss-diff ${i === ci ? 'on' : ''}" data-ci="${i}" role="tab" aria-selected="${i === ci}" style="--c:var(--${DCOL[x.difficulty] || 'up'})" title="${esc(x.title)}${x.author ? ' · by ' + esc(x.author) : ''}"><span>${esc(x.difficulty)}</span><b>${x.level || '?'}</b>${b ? `<em>${esc(b.grade)}</em>` : ''}</button>`; }).join('')}</div>
      <div class="ss-graph-wrap">${graph(c)}</div>
      <div class="ss-stats">
        <div><span class="lbl">Notes</span><span class="num">${c.notes.length}</span></div>
        <div><span class="lbl">Density</span><span class="num">${nps.toFixed(1)}<small>/s</small></span></div>
        <div><span class="lbl">Holds · chords</span><span class="num">${c.notes.filter(n => n.len).length} · ${countChords(c)}</span></div>
        <div><span class="lbl">Best</span><span class="num" style="color:var(--ball)">${best ? fmtNum(best.score) : '—'}</span><span class="lbl">${best ? `${esc(best.grade)} · ${best.acc}%${best.fc ? ' · FC' : ''}` : 'Not played'}</span></div>
      </div>
      <div class="ss-act">
        <button class="btn pri ss-play" data-a="play">${icon('play')}Play <span class="keycap">Enter</span></button>
        <button class="btn" data-a="auto" style="--c:var(--ball)">${icon('play')}Autoplay</button>
        ${own ? `<a class="btn" href="#/edit/${encodeURIComponent(c.id)}" style="--c:var(--left)">${icon('edit')}Edit</a>` : `<button class="btn" data-a="copy" style="--c:var(--left)">${icon('edit')}Edit a copy</button>`}
        <button class="btn" data-a="pack" title="Song + every chart for it in one file">${icon('down')}.bsq</button>
        ${!c.builtin ? `<button class="btn" data-a="del" style="--c:var(--bad)" aria-label="Remove chart">${icon('x')}</button>` : ''}
      </div>`;
    preview({ key: g.key, song: g.song, title: g.title, artist: g.artist, bpm: c.bpm, offset: c.offset || 0 });
  }
  function select(i, scroll = true) {
    if (!view.length) { renderList(); renderDetail(); return; }
    const changed = i !== gi; gi = clamp(i, 0, view.length - 1); if (changed) ci = Math.min(ci, view[gi].charts.length - 1);
    $$('.ss-row', list).forEach((r, j) => { r.classList.toggle('on', j === gi); r.setAttribute('aria-selected', j === gi); });
    if (scroll) list.children[gi]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    renderDetail();
  }
  renderList(); select(gi, false);
  requestAnimationFrame(() => list.children[gi]?.scrollIntoView({ block: 'center' }));

  const go = (auto) => { const c = view[gi]?.charts[ci]; if (c) nav('#/play/' + encodeURIComponent(c.id) + (auto ? '/auto' : '')); };
  list.addEventListener('click', e => { const r = e.target.closest('.ss-row'); if (!r) return; const i = +r.dataset.i; if (i === gi) go(); else select(i, false); });
  det.addEventListener('click', async e => {
    const d = e.target.closest('.ss-diff'); if (d) { ci = +d.dataset.ci; renderDetail(); return; }
    const a = e.target.closest('[data-a]')?.dataset.a, g = view[gi], c = g?.charts[ci];
    if (!a || !c) return;
    if (a === 'play') go();
    if (a === 'auto') go(true);
    if (a === 'pack') { toast('Packing…'); try { downloadBytes(slug(g.title) + '.bsq', await exportPack(c)); } catch (err) { toast('Export failed: ' + err.message, true); } }
    if (a === 'json') downloadText(slug(c.title) + '-' + c.difficulty.toLowerCase() + '.beatsqare.json', JSON.stringify({ format: 'beatsqare-chart', v: 1, ...c, id: undefined, builtin: undefined }, null, 1));
    if (a === 'copy') { const n = { ...c, id: uid(), title: c.title + ' (edit)', created: Date.now(), updated: Date.now(), bpmSet: true }; delete n.builtin; delete n.catalogId; await idb.putChart(n); nav('#/edit/' + n.id); }
    if (a === 'del' && confirm(`Remove “${c.title}” (${c.difficulty}) from this device?`)) { await idb.delChart(c.id); groups = await songGroups(); filter(); gi = Math.min(gi, view.length - 1); ci = 0; renderList(); select(gi, false); }
  });
  $('[data-q]').addEventListener('input', e => { q = e.target.value.trim(); filter(); gi = 0; ci = 0; renderList(); select(0, false); });
  $('[data-sort]').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', b.parentElement).forEach(x => x.classList.toggle('on', x === b));
    const key = view[gi]?.key; sort = b.dataset.v; filter(); gi = Math.max(0, view.findIndex(g => g.key === key)); renderList(); select(gi);
  });
  $('[data-imp]').addEventListener('change', async e => {
    const files = [...e.target.files]; let last = null, ok = 0;
    for (const f of files) { try { toast(`Importing ${f.name}…`); last = await importChartFile(f); ok++; } catch (err) { toast(`${f.name}: ${err.message}`, true); } }
    if (last) { toast(`Imported ${ok} file${ok === 1 ? '' : 's'}`); nav('#/library/' + encodeURIComponent(last.id)); }
    e.target.value = '';
  });
  const onKey = e => {
    if (e.target.matches('input')) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === 'ArrowDown') { e.target.blur(); if (e.key === 'Enter') go(); } return; }
    const k = e.key;
    if (k === '/') { e.preventDefault(); $('[data-q]').focus(); return; }
    if (k === 'ArrowDown' || k === 's') { e.preventDefault(); select(gi + 1); }
    else if (k === 'ArrowUp' || k === 'w') { e.preventDefault(); select(gi - 1); }
    else if (k === 'ArrowRight' || k === 'd') { e.preventDefault(); if (view[gi]) { ci = (ci + 1) % view[gi].charts.length; renderDetail(); } }
    else if (k === 'ArrowLeft' || k === 'a') { e.preventDefault(); if (view[gi]) { ci = (ci - 1 + view[gi].charts.length) % view[gi].charts.length; renderDetail(); } }
    else if (k === 'Enter') { e.preventDefault(); go(e.shiftKey); }
  };
  addEventListener('keydown', onKey);
  return () => removeEventListener('keydown', onKey);
}

function countChords(c) {
  let n = 0; const seen = new Map();
  for (const x of c.notes) { const k = x.t.toFixed(3); seen.set(k, (seen.get(k) || 0) + 1); }
  for (const v of seen.values()) if (v > 1) n++;
  return n;
}
