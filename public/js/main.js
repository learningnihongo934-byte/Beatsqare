// App shell: router + screens (title, song select, create, songs, catalog, settings) and the menu background.
import { ctx, ac, loadSong, outAt, outNow, click, energy, applyVolume, rememberBuffer, decode, songKey, renderDemo } from './audio.js';
import { songMeta, askSongInfo, readTags, tidySongInfo, THEMES, applyTheme, setArt, setVideo } from './util.js';
import { DIR, adjacent } from './util.js';
import { hitSound } from './audio.js';
import { $, $$, esc, icon, toast, api, idb, getSettings, saveSettings, getBest, fmtTime, fmtNum, clamp, uploadFile, downloadText, slug, COLORS, DIFFS, approachTime, uid } from './util.js';
import { DEMO_CHARTS, newChart, saveCatalogChart, importChartFile } from './charts.js';
import { playChart, chartKey, abortGame } from './game.js';
import { openEditor, getAnalysis } from './editor.js';
import { detectBpm, detectSections, autoChartTimed } from './analysis.js';
import { exportPack, downloadBytes } from './pack.js';
import { CHANGELOG, LATEST } from './changelog.js';
import { shop, profileScreen, eqNow } from './meta.js';
import { profile, levelOf, daily as dailyOf, TOKEN, fmtTok, titleName, unlock, ownedThemes } from './profile.js';
import { MiniScene } from './cosmetics.js';
import { uiSound } from './audio.js';
import { songSelect, credit } from './select.js';
import { playRandom, skip, toggleMute, stopMusic, onMusic, nowPlaying, beatPos, musicPos } from './music.js';

const app = $('#app');
const S = getSettings();
saveSettings();
let closeScreen = null;

const NAV = [['#/library', 'Play', 'up'], ['#/create', 'Create', 'right'], ['#/songs', 'Songs', 'down'], ['#/catalog', 'Catalog', 'left'], ['#/shop', 'Shop', 'up'], ['#/settings', 'Settings', 'right']];
const pchip = () => { const P = profile(), lv = levelOf(); return `<span class="pl">LV<b>${lv.level}</b></span><span class="xpbar"><i style="width:${(lv.into / lv.need * 100).toFixed(1)}%"></i></span><span class="pt">${TOKEN}<b>${fmtTok(P.tokens)}</b></span>`; };
addEventListener('bsq:profile', () => document.querySelectorAll('[data-pchip]').forEach(el => (el.innerHTML = pchip())));
const bar = active => `<nav class="rail" aria-label="Main">
  <a class="rail-home" href="#/" title="Home" aria-label="Home"><span class="logo-mark"><i></i><i></i><i></i><i></i><b></b></span></a>
  <div class="rail-items">${NAV.map(([h, t, c]) => `<a href="${h}" class="${active === h ? 'on' : ''}" style="--c:var(--${c})"><i></i><span>${t}</span></a>`).join('')}<a href="#/profile" class="phone-only ${active === '#/profile' ? 'on' : ''}" style="--c:var(--down)"><i></i><span>You</span></a></div>
  <a class="pchip rail-me ${active === '#/profile' ? 'on' : ''}" href="#/profile" data-pchip title="Profile">${pchip()}</a>
</nav>`;

// ---------- router
async function route() {
  wipe();
  abortGame();
  if (closeScreen) { const c = closeScreen; closeScreen = null; await c(); }
  const nextName = ((location.hash || '#/').match(/^#\/([\w-]*)/) || [])[1];
  if (nextName === 'play' || nextName === 'edit') stopMusic(0.3);
  const h = location.hash || '#/';
  const [, name, arg] = h.match(/^#\/([\w-]*)\/?(.*)$/) || [];
  window.scrollTo(0, 0);
  bgOn = true;
  document.body.classList.toggle('railed', !!name && name !== 'play' && name !== 'edit');
  document.body.classList.toggle('home-on', !name);
  if (!name) return title();
  if (name === 'library') return library(arg);
  if (name === 'play') return play(arg);
  if (name === 'create') return create();
  if (name === 'edit') { bgOn = false; app.innerHTML = ''; closeScreen = await openEditor(decodeURIComponent(arg), nav); return; }
  if (name === 'songs') return songs();
  if (name === 'catalog') return catalog();
  if (name === 'settings') return settings();
  if (name === 'updates') return updates();
  if (name === 'shop') { closeScreen = shop(app, bar); return; }
  if (name === 'profile') return profileScreen(app, bar);
  title();
}
const nav = h => { if (location.hash === h) route(); else location.hash = h; };
addEventListener('hashchange', route);
// first user gesture unlocks audio
addEventListener('pointerdown', () => ctx(), { once: true });
addEventListener('keydown', () => ctx(), { once: true });

// ---------- home: the menu is the game box. Sides and corners are destinations; move the ball like in the game.
const DESTS = [
  { k: '0', href: '#/library', t: 'Play', d: 'Song select', cls: 'd-up' },
  { k: '1', href: '#/create', t: 'Create', d: 'Level editor', cls: 'd-right' },
  { k: '2', href: '#/songs', t: 'Songs', d: 'Search · upload', cls: 'd-down' },
  { k: '3', href: '#/catalog', t: 'Catalog', d: 'Community charts', cls: 'd-left' },
  { k: '30', href: '#/profile', t: 'Profile', cls: 'c-ul' },
  { k: '01', href: '#/shop', t: 'Shop', cls: 'c-ur' },
  { k: '12', href: '#/settings', t: 'Settings', cls: 'c-dr' },
  { k: '23', href: '#/updates', t: 'Updates', cls: 'c-dl' },
];
const HKEYS = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
const cornerKey = (a, b) => { const p = [a, b].sort(); return p[0] === 0 && p[1] === 3 ? '30' : '' + p[0] + p[1]; };
const vecOf = k => k.length === 1 ? DIR[+k] : [DIR[+k[0]][0] + DIR[+k[1]][0], DIR[+k[0]][1] + DIR[+k[1]][1]];
const SECTOR = ['1', '12', '2', '23', '3', '30', '0', '01']; // 8-way by angle, starting at "right"
let homeBox = null, homeFlash = () => {};

function title() {
  const P = profile(), lv = levelOf();
  app.innerHTML = `<section class="home">
    <div class="hm-stage">
      <div class="hm-box" data-box>
        ${[0, 1, 2, 3].map(L => `<i class="hm-side s${L}" data-side="${L}"></i>`).join('')}
        <span class="hm-tick t0"></span><span class="hm-tick t1"></span><span class="hm-tick t2"></span><span class="hm-tick t3"></span>
        <div class="hm-inside">
          <div class="hm-word disp"><span>Beat</span><span>sqare</span></div>
          <div class="np" data-np></div>
        </div>
        <div class="hm-ball" data-ball></div>
        ${DESTS.map(d => `<a class="hm-dest ${d.cls} ${d.k.length > 1 ? 'corner' : 'side'}" href="${d.href}" data-k="${d.k}" style="--c:var(--${['up', 'right', 'down', 'left'][+d.k[0]]})">
          <b>${d.t}</b>${d.d ? `<i>${d.d}</i>` : ''}${d.k === '30' ? `<i>LV ${lv.level} · ${TOKEN} ${fmtTok(P.tokens)}</i>` : ''}${d.k === '23' ? `<i>v${LATEST}${seenVersion() !== LATEST ? ' · new' : ''}</i>` : ''}</a>`).join('')}
      </div>
    </div>
    <div class="hm-help lbl">
      <span><span class="keycap">↑</span><span class="keycap">→</span><span class="keycap">↓</span><span class="keycap">←</span> pick a side</span>
      <span><span class="keycap">↑</span>+<span class="keycap">→</span> corner</span>
      <span><span class="keycap">Enter</span> or press again to go</span>
      <span class="hm-touch">Swipe to aim · lift to go</span>
    </div>
    <div class="marquee" aria-hidden="true"><div class="mq" data-mq></div></div>
  </section>`;
  const box = $('[data-box]'), ballEl = $('[data-ball]'), dests = $$('.hm-dest'), sides = $$('.hm-side');
  homeBox = box;
  let sel = null, tgt = [0, 0], pos = [0, 0], held = [], lastPress = { k: null, t: 0 }, going = false, swipe = null, raf = 0, last = performance.now();
  let onTouchMove, onTouchUp;
  const flash = (L, strong = true) => sides[L]?.animate(strong
    ? [{ filter: 'brightness(3.2)', transform: 'scale(1.04)' }, { filter: 'brightness(1)', transform: 'scale(1)' }]
    : [{ filter: 'brightness(1.9)' }, { filter: 'brightness(1)' }], { duration: strong ? 320 : 200, easing: 'cubic-bezier(.2,.7,.2,1)' });
  homeFlash = L => flash(L, false);
  function select(k) {
    if (sel === k) return;
    sel = k; tgt = k ? vecOf(k) : [0, 0];
    dests.forEach(d => d.classList.toggle('hot', d.dataset.k === k));
    box.dataset.sel = k || '';
    if (k) uiSound('hover');
  }
  function burst() {
    const r = box.getBoundingClientRect(), bx = ballEl.getBoundingClientRect(), cx = bx.left + bx.width / 2 - r.left, cy = bx.top + bx.height / 2 - r.top;
    for (let i = 0; i < 16; i++) {
      const sp = document.createElement('span'); sp.className = 'hm-spark';
      sp.style.left = cx + 'px'; sp.style.top = cy + 'px'; sp.style.background = COLORS[(Math.random() * 4) | 0];
      box.appendChild(sp);
      const a = Math.random() * 6.283, d = 40 + Math.random() * 120;
      sp.animate([{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) rotate(${a * 90}deg)`, opacity: 0 }], { duration: 420 + Math.random() * 200, easing: 'cubic-bezier(.1,.7,.3,1)' }).onfinish = () => sp.remove();
    }
  }
  function go(k) {
    if (going || !k) return;
    going = true; select(k); tgt = vecOf(k).map(v => v * 1.08);
    ctx();
    for (const L of k.split('').map(Number)) { flash(L); hitSound(L); }
    uiSound('click'); burst();
    box.classList.add('going');
    setTimeout(() => nav(DESTS.find(d => d.k === k).href), 220);
  }
  const onKey = e => {
    if (e.key === 'Enter' || e.key === ' ') { if (sel) { e.preventDefault(); go(sel); } return; }
    const L = HKEYS[e.code]; if (L === undefined || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); if (e.repeat) return;
    if (!held.includes(L)) held.push(L);
    const h = held.slice(-2), k = h.length === 2 && adjacent(h[0], h[1]) ? cornerKey(h[0], h[1]) : '' + L;
    const now = performance.now();
    if (k === sel && lastPress.k === k && now - lastPress.t < 900) go(k);
    lastPress = { k, t: now };
    select(k);
  };
  const onKeyUp = e => { const L = HKEYS[e.code]; if (L !== undefined) held = held.filter(x => x !== L); };
  const sectorOf = (dx, dy) => SECTOR[((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
  const home = $('.home');
  home.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' || going) return;
    if (swipe) return;
    const r = box.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.16) return;
    select(sectorOf(dx, dy));
  });
  home.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') swipe = { x: e.clientX, y: e.clientY, k: null }; });
  addEventListener('pointermove', onTouchMove = e => {
    if (!swipe || e.pointerType !== 'touch') return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    if (Math.hypot(dx, dy) > 28) { swipe.k = sectorOf(dx, dy); select(swipe.k); }
  });
  addEventListener('pointerup', onTouchUp = () => { if (swipe && swipe.k) go(swipe.k); swipe = null; });
  home.addEventListener('click', e => {
    const d = e.target.closest('.hm-dest');
    if (d) { e.preventDefault(); go(d.dataset.k); return; }
    if (e.target.closest('[data-box]') && !e.target.closest('.np') && sel) go(sel);
  });
  addEventListener('keydown', onKey); addEventListener('keyup', onKeyUp);
  (function tick(ts) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, ((ts || performance.now()) - last) / 1000); last = ts || performance.now();
    const k = 1 - Math.exp(-dt * 38);
    pos[0] += (tgt[0] - pos[0]) * k; pos[1] += (tgt[1] - pos[1]) * k;
    const reach = box.clientWidth / 2 - ballEl.offsetWidth / 2 - 10;
    ballEl.style.transform = `translate(${pos[0] * reach}px, ${pos[1] * reach}px)`;
    const i = nowPlaying(), b = $('[data-npbar]'); if (i && b && i.duration) b.style.width = Math.min(100, musicPos() / i.duration * 100) + '%';
  })();
  // marquee: daily challenge, player, last play, tips
  (async () => {
    const charts = [...DEMO_CHARTS, ...(await idb.charts().catch(() => []))], dl = dailyOf(charts), last2 = (P.recent || [])[0];
    const tips = ['Two keys at once send the ball to a corner', 'Pierce notes come from the opposite side · hit the side of their colour', 'Detect in the editor finds tempo changes', 'Import a .bsq to get a whole song with its charts', 'Calibrate your offset in Settings if hits feel early or late', 'Everything at the prize counter is cosmetic'];
    const items = [
      dl ? `Daily · ${esc(dl.title)} ${esc(dl.difficulty)} · ${esc(dl.goal.text)} · ${dl.done ? 'complete' : '+' + dl.reward + ' tokens'}` : null,
      `${esc(getSettings().handle)} · ${esc(titleName())} · level ${lv.level} · ${fmtTok(P.tokens)} tokens`,
      last2 ? `Last play · ${esc(last2.title)} ${esc(last2.difficulty)} · ${esc(last2.grade)} · ${fmtTok(last2.score)}` : 'Insert coin · press any arrow',
      ...tips.sort(() => Math.random() - 0.5).slice(0, 3),
    ].filter(Boolean);
    const run = items.map(t => `<span>${t}</span><i>◆</i>`).join('');
    const mq = $('[data-mq]'); if (mq) mq.innerHTML = run + run;
  })();
  const np = $('[data-np]');
  const draw = info => {
    if (!getSettings().menuMusic) { np.innerHTML = `<button class="btn sm" data-np="mute">Music on</button>`; return; }
    if (!info) { np.innerHTML = `<span class="lbl">${ac && ac.state === 'running' ? 'Picking a song…' : 'Press a key for music'}</span>`; return; }
    np.innerHTML = `<div class="np-t"><b>${esc(info.title)}</b><span class="muted">${esc(info.artist || '')}</span></div><div class="np-bar"><i data-npbar></i></div>
      <div class="np-acts"><button class="btn sm" data-np="skip">Skip</button><button class="btn sm" data-np="mute">Mute</button></div>`;
  };
  np.addEventListener('click', e => { const a = e.target.closest('[data-np]')?.dataset.np; if (!a) return; e.stopPropagation(); if (a === 'skip') skip(); if (a === 'mute') { toggleMute(); draw(nowPlaying()); } });
  const off = onMusic(draw); draw(nowPlaying());
  const begin = () => { if (!nowPlaying()) playRandom(); };
  if (ac && ac.state === 'running') begin();
  const gesture = () => { ctx(); begin(); };
  addEventListener('pointerdown', gesture, { once: true }); addEventListener('keydown', gesture, { once: true });
  closeScreen = () => {
    off(); cancelAnimationFrame(raf);
    removeEventListener('pointerdown', gesture); removeEventListener('keydown', gesture);
    removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp);
    removeEventListener('pointermove', onTouchMove); removeEventListener('pointerup', onTouchUp);
    homeBox = null; homeFlash = () => {};
  };
}

// ---------- song select (select.js)
async function library(selId) { closeScreen = await songSelect(app, bar, nav, selId); }

// ---------- play
async function play(arg) {
  const [rawId, mode] = arg.split('/');
  const id = decodeURIComponent(rawId), autoplay = mode === 'auto';
  const c0 = DEMO_CHARTS.find(x => x.id === id) || await idb.chart(id);
  if (!c0) { toast('Chart not found', true); return nav('#/library'); }
  const m = songMeta(songKey(c0.song)), c = m && c0.builtin ? { ...c0, title: m.title, artist: m.artist } : c0;
  bgOn = false; app.innerHTML = '';
  let action = 'restart';
  while (action === 'restart') ({ action } = await playChart(c, { autoplay, editable: !c.builtin && !c.id.startsWith('cat-') }));
  if (action === 'nav') return;
  if (action === 'edit') nav('#/edit/' + encodeURIComponent(c.id));
  else nav('#/library/' + encodeURIComponent(c.id));
}

// ---------- create
function create() {
  app.innerHTML = `${bar('#/create')}<section class="page">
    <div class="span-12 head" style="margin:0"><h2 class="sec-title">New chart</h2><span class="lbl">Pick a song to chart</span></div>
    <div class="span-4 frame pad" style="--c:var(--up)"><div class="lbl">01</div><h3 class="disp" style="font-size:26px;margin:10px 0">Demo track</h3><p class="muted">Chart “Square One”, the built-in 128 BPM track. No download.</p><button class="btn pri" data-a="demo" style="--c:var(--up)">Start charting</button></div>
    <div class="span-4 frame pad" style="--c:var(--down)"><div class="lbl">02</div><h3 class="disp" style="font-size:26px;margin:10px 0">Upload a song</h3><p class="muted">MP3, MP4, OGG or WAV up to 24 MB. It's stored online so your published charts play anywhere.</p>${dropZone()}</div>
    <div class="span-4 frame pad" style="--c:var(--right)"><div class="lbl">03</div><h3 class="disp" style="font-size:26px;margin:10px 0">Find a song</h3><p class="muted">Search Audius, preview, and chart any streamable track. Artist and license are shown on every track.</p><a class="btn pri" href="#/songs" style="--c:var(--right)">${icon('search')}Search songs</a></div>
    <div class="span-12 row"><label class="btn sm">${icon('up')}Import .bsq or chart JSON<input type="file" accept=".bsq,.json,application/json" hidden data-imp></label></div>
  </section>`;
  $('[data-a=demo]').onclick = async () => { const c = await newChart({ source: 'builtin', ref: 'square-one', license: 'Original, made for Beatsqare', credit: 'Beatsqare House Band' }); nav('#/edit/' + c.id); };
  wireDrop();
  $('[data-imp]').addEventListener('change', async e => { try { const c = await importChartFile(e.target.files[0]); nav('#/edit/' + c.id); } catch (err) { toast('Import failed: ' + err.message, true); } });
}
const dropZone = () => `<label class="drop" data-drop><input type="file" accept="audio/*,video/mp4,.mp3,.ogg,.wav,.mp4,.m4a" hidden data-file><div class="lbl">Drop a file or click</div><div class="muted" style="font-size:11px;margin-top:6px" data-dmsg>mp3 · mp4 · ogg · wav</div><div class="bar-prog"><i data-dprog></i></div></label>`;
function wireDrop() {
  const z = $('[data-drop]'), inp = $('[data-file]');
  z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('over'); });
  z.addEventListener('dragleave', () => z.classList.remove('over'));
  z.addEventListener('drop', e => { e.preventDefault(); z.classList.remove('over'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
  inp.addEventListener('change', () => inp.files[0] && handleFile(inp.files[0]));
}
async function handleFile(file) {
  const msg = $('[data-dmsg]'), pr = $('[data-dprog]');
  if (file.size > 24 * 1024 * 1024) return toast('That file is over 24 MB', true);
  msg.textContent = 'Checking audio…';
  const raw = await file.arrayBuffer();
  let buf;
  try { buf = await decode(raw); } catch { msg.textContent = 'mp3 · ogg · wav'; return toast("Couldn't read that audio file", true); }
  const name = file.name.replace(/\.[^.]+$/, '');
  const dash = name.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  const fromName = tidySongInfo(dash ? { artist: dash[1], title: dash[2] } : { title: name });
  const tags = readTags(raw), fromTags = tags && tidySongInfo(tags);
  const info = await askSongInfo({ title: fromTags?.title || fromName.title, artist: fromTags?.artist || fromName.artist, source: tags ? 'From the file’s tags' : 'From the file name' }, 'Name this song', { art: tags?.picture || null, fromFile: async () => tags?.picture || null });
  if (!info) { msg.textContent = 'mp3 · mp4 · ogg · wav'; return; }
  const { title, artist } = info;
  let song;
  try {
    msg.textContent = 'Uploading…';
    const up = await uploadFile(file, p => (pr.style.width = p * 100 + '%'));
    song = { source: 'upload', ref: up.id, credit: artist || name, license: 'Uploaded by ' + S.handle, mime: file.type };
  } catch (e) {
    toast('Upload failed (' + e.message + '), keeping it on this device', true);
    song = { source: 'local', ref: uid(), credit: artist || name, license: 'Local file', mime: file.type };
  }
  await idb.putAudio(songKey(song), raw);
  if (/^video\//.test(file.type) || /\.(mp4|webm|mov)$/i.test(file.name)) await setVideo(songKey(song), file);
  if (info.art) await setArt(songKey(song), info.art);
  rememberBuffer(song, buf);
  const c = await newChart(song, { title, artist, duration: buf.duration });
  nav('#/edit/' + c.id);
}

// ---------- songs (Audius + upload)
let audioEl = null;
function songs() {
  app.innerHTML = `${bar('#/songs')}<section class="page">
    <div class="span-12 head" style="margin:0"><h2 class="sec-title">Songs</h2><span class="lbl">Streaming via Audius · no account needed</span></div>
    <div class="span-12">
      <div class="tabs" style="--c:var(--down)"><button class="on" data-tab="search">Search Audius</button><button data-tab="upload">Upload a file</button></div>
      <div data-pane="search">
        <form class="toolbar" data-form><input class="input grow" name="q" placeholder="Search tracks, artists, genres" autocomplete="off"><button class="btn" type="submit">${icon('search')}Search</button>
          <label class="row" style="font-size:11px;gap:6px"><input type="checkbox" name="cc"> Creative Commons only</label></form>
        <div class="lbl" data-what style="margin-bottom:8px">Trending now</div>
        <div class="list" data-list><div class="empty">Loading…</div></div>
        <p class="credit">Tracks stream from <a href="https://audius.co" target="_blank" rel="noopener">Audius</a>, an artist-run music platform with an open API. Every track credits its artist and shows its license; tap a title to open it on Audius.</p>
      </div>
      <div data-pane="upload" hidden><div class="frame pad" style="--c:var(--down);max-width:640px">${dropZone()}<p class="muted" style="font-size:11px">Your file is stored on Beatsqare's server so charts made with it play on any device.</p></div></div>
    </div></section>`;
  $$('.tabs button').forEach(b => b.onclick = () => { $$('.tabs button').forEach(x => x.classList.toggle('on', x === b)); $$('[data-pane]').forEach(p => (p.hidden = p.dataset.pane !== b.dataset.tab)); });
  wireDrop();
  const form = $('[data-form]');
  let results = [];
  async function load(q) {
    const cc = form.cc.checked ? '&cc=1' : '';
    $('[data-what]').textContent = q ? `Results for “${q}”` : 'Trending now';
    $('[data-list]').innerHTML = '<div class="empty">Loading…</div>';
    try {
      ({ tracks: results } = await api(q ? `/audius/search?q=${encodeURIComponent(q)}${cc}` : `/audius/trending?x=1${cc}`));
      render();
    } catch (e) { $('[data-list]').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }
  function render() {
    $('[data-list]').innerHTML = results.length ? results.map((t, i) => `<div class="item">
      <div class="thumb" style="${t.art ? `background-image:url('${esc(t.art)}')` : ''}"></div>
      <div style="min-width:0"><a class="t" href="${esc(t.link)}" target="_blank" rel="noopener" style="text-decoration:none;display:block">${esc(t.title)}</a>
        <div class="s">${esc(t.artist)} · ${fmtTime(t.duration)}${t.genre ? ' · ' + esc(t.genre) : ''}</div>
        <div class="tags"><span class="badge ${/CC/.test(t.license) ? 'c-down' : 'dim'}">${esc(t.license)}</span>${t.bpm ? `<span class="badge dim">${Math.round(t.bpm)} BPM</span>` : ''}</div></div>
      <div class="acts"><button class="btn sm" data-a="prev" data-i="${i}">${icon('play')}Preview</button><button class="btn sm" data-a="chart" data-i="${i}" style="--c:var(--right)">${icon('edit')}Chart it</button><button class="btn sm pri" data-a="auto" data-i="${i}" style="--c:var(--down)">${icon('wand')}Auto-play</button></div>
    </div>`).join('') : '<div class="empty">No streamable tracks found. Try another search.</div>';
  }
  form.onsubmit = e => { e.preventDefault(); load(form.q.value.trim()); };
  form.cc.onchange = () => load(form.q.value.trim());
  $('[data-list]').addEventListener('click', async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const t = results[+b.dataset.i];
    const song = { source: 'audius', ref: t.id, credit: t.artist, license: t.license, link: t.link, art: t.art };
    if (b.dataset.a === 'prev') {
      if (audioEl && audioEl.dataset.id === t.id && !audioEl.paused) { audioEl.pause(); b.innerHTML = icon('play') + 'Preview'; return; }
      if (audioEl) audioEl.pause();
      stopMusic(0.3);
      $$('[data-a=prev]').forEach(x => (x.innerHTML = icon('play') + 'Preview'));
      audioEl = new Audio('/api/audius/stream/' + t.id); audioEl.dataset.id = t.id; audioEl.volume = S.volume;
      audioEl.play().catch(() => toast('Preview failed', true)); b.innerHTML = icon('pause') + 'Stop';
      return;
    }
    if (audioEl) audioEl.pause();
    if (b.dataset.a === 'chart') { const c = await newChart(song, { title: t.title, artist: t.artist, duration: t.duration }); nav('#/edit/' + c.id); }
    if (b.dataset.a === 'auto') autoPlay(song, t);
  });
  closeScreen = () => { if (audioEl) { audioEl.pause(); audioEl = null; } };
  load('');
}
async function autoPlay(song, t) {
  const ov = document.createElement('div');
  ov.className = 'overlay'; ov.style.position = 'fixed'; ov.style.zIndex = 30;
  ov.innerHTML = `<div class="panel frame pad" style="--c:var(--down);text-align:center"><div class="lbl" data-st>Downloading song</div><div class="num" style="font-size:40px;margin-top:8px" data-p>0%</div><p class="muted" style="font-size:11px">${esc(t.title)} · ${esc(t.artist)}</p></div>`;
  document.body.appendChild(ov);
  try {
    const buf = await loadSong(song, p => ($('[data-p]', ov).textContent = p >= 0 ? Math.round(p * 100) + '%' : Math.round(-p / 1024) + ' KB'));
    $('[data-st]', ov).textContent = 'Listening for the beat';
    const A = await getAnalysis(song, buf, p => ($('[data-p]', ov).textContent = Math.round(p * 100) + '%'));
    const main = detectBpm(A), tp = await detectSections(A, main), { bpm } = tp[0], offset = tp.length > 1 ? tp[0].t % (60 / bpm) : tp[0].t;
    const c = await newChart(song, { title: t.title, artist: t.artist, duration: buf.duration });
    Object.assign(c, { bpm, offset, ...(tp.length > 1 ? { timing: tp } : {}), bpmSet: true, notes: autoChartTimed(A, tp, 'Normal'), difficulty: 'Normal', level: 6, title: t.title + ' (auto)' });
    await idb.putChart(c);
    ov.remove();
    nav('#/play/' + c.id);
  } catch (e) { ov.remove(); toast('Could not auto-chart: ' + e.message, true); }
}

// ---------- catalog
function catalog() {
  let diff = '', sort = 'plays', items = [];
  app.innerHTML = `${bar('#/catalog')}<section class="page">
    <div class="span-12 head" style="margin:0"><h2 class="sec-title">Catalog</h2><span class="lbl">Community charts · playing as ${esc(S.handle)}</span></div>
    <div class="span-12">
      <form class="toolbar" data-form><input class="input grow" name="q" placeholder="Search title, artist or charter" autocomplete="off">
        <div class="seg" data-seg="diff" style="--c:var(--left)"><button type="button" data-v="" class="on">All</button>${DIFFS.map(d => `<button type="button" data-v="${d}">${d}</button>`).join('')}</div>
        <div class="seg" data-seg="sort" style="--c:var(--right)"><button type="button" data-v="plays" class="on">Most played</button><button type="button" data-v="likes">Most liked</button><button type="button" data-v="new">New</button></div>
      </form>
      <div class="list" data-list><div class="empty">Loading…</div></div>
    </div></section>`;
  const form = $('[data-form]');
  async function load() {
    try {
      ({ charts: items } = await api(`/charts?q=${encodeURIComponent(form.q.value.trim())}&diff=${diff}&sort=${sort}`));
      const liked = JSON.parse(localStorage.getItem('bsq.liked') || '[]');
      $('[data-list]').innerHTML = items.length ? items.map((c, i) => `<div class="item">
        <div class="thumb sq" style="${c.song_source === 'audius' ? '' : ''}">${miniBox(i)}</div>
        <div style="min-width:0"><div class="t">${esc(c.title)}</div><div class="s">${esc(c.artist || '—')} · chart by ${esc(c.author)} · ${fmtTime(c.duration)} · ${+(+c.bpm).toFixed(1)} BPM</div>
          <div class="tags"><span class="badge diff-${esc(c.difficulty)}">${esc(c.difficulty)} ${c.level}</span><span class="badge dim">${c.notes} notes</span><span class="badge dim">${fmtNum(c.plays)} plays</span>${c.song_license ? `<span class="badge dim" title="Song license">${esc(c.song_license)}</span>` : ''}</div>
          <div class="s" style="margin-top:4px">Song: ${esc(c.song_credit || c.artist || '')}${c.song_source === 'audius' ? ' via Audius' : c.song_source === 'builtin' ? ' (built-in)' : ' (upload)'}</div></div>
        <div class="acts"><button class="btn sm ${liked.includes(c.id) ? 'on' : ''}" data-a="like" data-i="${i}" style="--c:var(--right)" aria-label="Like">${icon('heart')}<span>${c.likes}</span></button><button class="btn sm" data-a="save" data-i="${i}">Save</button><button class="btn sm pri" data-a="play" data-i="${i}">${icon('play')}Play</button></div>
      </div>`).join('') : '<div class="empty">No charts yet. Make one in the editor and hit Publish.</div>';
    } catch (e) { $('[data-list]').innerHTML = `<div class="empty">Catalog offline: ${esc(e.message)}</div>`; }
  }
  form.onsubmit = e => { e.preventDefault(); load(); };
  let qt; form.q.oninput = () => { clearTimeout(qt); qt = setTimeout(load, 300); };
  form.addEventListener('click', e => {
    const b = e.target.closest('.seg button'); if (!b) return;
    b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    if (b.parentElement.dataset.seg === 'diff') diff = b.dataset.v; else sort = b.dataset.v;
    load();
  });
  $('[data-list]').addEventListener('click', async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const c = items[+b.dataset.i];
    if (b.dataset.a === 'like') {
      try {
        const r = await api('/charts/' + c.id + '/like', { method: 'POST', body: JSON.stringify({ handle: S.handle }) });
        let liked = JSON.parse(localStorage.getItem('bsq.liked') || '[]'); liked = r.liked ? [...new Set([...liked, c.id])] : liked.filter(x => x !== c.id);
        localStorage.setItem('bsq.liked', JSON.stringify(liked));
        b.classList.toggle('on', r.liked); b.querySelector('span').textContent = r.likes; c.likes = r.likes;
      } catch (err) { toast(err.message, true); }
      return;
    }
    try {
      const full = await api('/charts/' + c.id);
      const local = await saveCatalogChart(full);
      if (b.dataset.a === 'save') { toast('Saved to your library'); b.textContent = 'Saved'; b.disabled = true; }
      else nav('#/play/' + encodeURIComponent(local.id));
    } catch (err) { toast(err.message, true); }
  });
  load();
}
const miniBox = i => `<svg viewBox="0 0 24 24" width="28" height="28"><path d="M4 4h16" stroke="${COLORS[0]}" stroke-width="1.6"/><path d="M20 4v16" stroke="${COLORS[1]}" stroke-width="1.6"/><path d="M20 20H4" stroke="${COLORS[2]}" stroke-width="1.6"/><path d="M4 20V4" stroke="${COLORS[3]}" stroke-width="1.6"/><circle cx="${[12, 17, 12, 7][i % 4]}" cy="${[7, 12, 17, 12][i % 4]}" r="2" fill="#fff6a0"/></svg>`;

// ---------- settings + calibration
function settings() {
  const rows = [
    ['speed', 'Note speed', 1, 10, 1, v => `${v} · ${approachTime(v).toFixed(2)}s`],
    ['audioOffset', 'Audio offset', -250, 250, 1, v => `${v} ms`],
    ['visualOffset', 'Visual offset', -150, 150, 1, v => `${v} ms`],
    ['volume', 'Music volume', 0, 1, 0.05, v => Math.round(v * 100) + '%'],
    ['hitVolume', 'Hit sound volume', 0, 1, 0.05, v => Math.round(v * 100) + '%'],
  ];
  const toggles = [['bgVideo', 'Background video while playing'], ['menuMusic', 'Menu music'], ['uiSounds', 'Menu sounds'], ['hitsounds', 'Hit sounds'], ['crt', 'CRT bloom + scanlines'], ['shake', 'Screen shake on miss'], ['particles', 'Hit particles']];
  app.innerHTML = `${bar('#/settings')}<section class="page">
    <div class="span-12 head" style="margin:0"><h2 class="sec-title">Settings</h2><span class="lbl">Saved on this device</span></div>
    <div class="span-12 frame pad theme" data-theme style="--c:var(--right)"></div>
    <div class="span-7">
      <div class="set-row"><span class="lbl">Handle</span><input class="input" data-k="handle" value="${esc(S.handle)}" maxlength="24"><span class="v dim">public</span></div>
      ${rows.map(([k, l, a, b, st, f]) => `<div class="set-row"><span class="lbl">${l}</span><input type="range" data-k="${k}" min="${a}" max="${b}" step="${st}" value="${S[k]}"><span class="v" data-v="${k}">${f(S[k])}</span></div>`).join('')}
      ${toggles.map(([k, l]) => `<label class="set-row" style="cursor:pointer"><span class="lbl">${l}</span><span></span><span class="v"><input type="checkbox" data-k="${k}" ${S[k] ? 'checked' : ''}></span></label>`).join('')}
    </div>
    <div class="span-5 frame pad" style="--c:var(--ball)">
      <div class="head"><h3 class="sec-title" style="font-size:20px">Calibrate</h3><span class="lbl">Use headphones you play with</span></div>
      <div class="tabs"><button class="on" data-cal="audio">Audio · tap</button><button data-cal="visual">Visual · watch</button></div>
      <div class="cal" data-pad tabindex="0"><div class="cal-sq" data-sq></div><div class="lbl" style="position:absolute;bottom:10px" data-cmsg>Press Start, then tap any key on each click</div></div>
      <div class="taps" data-taps></div>
      <div class="row" style="margin-top:12px"><button class="btn pri" data-a="start" style="--c:var(--ball)">Start</button><button class="btn" data-a="apply" disabled>Apply</button><span class="muted" data-res style="font-size:12px"></span></div>
      <p class="help" data-help>Audio: we play 16 clicks. Tap on each one; the median gap becomes your audio offset, so judgement matches what you hear.</p>
    </div></section>`;
  // ---- theme: presets + custom colour per side and ball
  const SIDE = ['Up', 'Right', 'Down', 'Left'];
  const allThemes = () => [...THEMES, ...ownedThemes().map(i => ({ name: i.name, colors: i.colors, ball: i.ball }))];
  const curTheme = () => S.theme && S.theme.colors ? S.theme : { ...THEMES[0], colors: [...THEMES[0].colors] };
  const swatch = t => `<span class="sw">${t.colors.map(c => `<i style="background:${c}"></i>`).join('')}<b style="background:${t.ball}"></b></span>`;
  const box = t => `<svg viewBox="0 0 60 60" class="theme-box" aria-hidden="true"><path d="M12 12h36" stroke="${t.colors[0]}" stroke-width="3"/><path d="M48 12v36" stroke="${t.colors[1]}" stroke-width="3"/><path d="M48 48H12" stroke="${t.colors[2]}" stroke-width="3"/><path d="M12 48V12" stroke="${t.colors[3]}" stroke-width="3"/><circle cx="30" cy="30" r="4" fill="${t.ball}"/></svg>`;
  function renderTheme() {
    const t = curTheme(), same = p => p.colors.every((c, i) => c.toLowerCase() === t.colors[i].toLowerCase()) && p.ball.toLowerCase() === t.ball.toLowerCase();
    $('[data-theme]').innerHTML = `<div class="head"><h3 class="sec-title" style="font-size:20px">Theme</h3><span class="lbl">Colours of the four sides and the ball, everywhere in the game</span></div>
      <div class="theme-grid">
        <div>${box(t)}</div>
        <div><span class="lbl">Presets</span><div class="presets"><button class="preset auto ${S.autoColor ? 'on' : ''}" data-auto title="During background videos, each side takes the inverse of the video behind it"><span class="sw auto-sw"><i></i><i></i><i></i><i></i><b></b></span><span>Auto · video</span></button>${allThemes().map((p, i) => `<button class="preset ${same(p) ? 'on' : ''}" data-preset="${i}">${swatch(p)}<span>${esc(p.name)}</span></button>`).join('')}</div><a class="lbl" href="#/shop" style="display:inline-block;margin-top:8px">More themes at the prize counter →</a></div>
        <div><span class="lbl">Custom</span><div class="pickers">${SIDE.map((n, i) => `<label class="picker"><input type="color" data-col="${i}" value="${t.colors[i]}"><span>${n}</span></label>`).join('')}<label class="picker"><input type="color" data-col="ball" value="${t.ball}"><span>Ball</span></label></div></div>
      </div>`;
  }
  renderTheme();
  $('[data-theme]').addEventListener('click', e => {
    if (e.target.closest('[data-auto]')) { saveSettings({ autoColor: !S.autoColor }); renderTheme(); toast(S.autoColor ? 'Auto colours on: sides invert the background video' : 'Auto colours off'); return; }
    const b = e.target.closest('[data-preset]'); if (!b) return;
    const p = allThemes()[+b.dataset.preset];
    saveSettings({ theme: { colors: [...p.colors], ball: p.ball } }); applyTheme(); renderTheme(); unlock('theme');
  });
  $('[data-theme]').addEventListener('input', e => {
    const k = e.target.dataset.col; if (k === undefined) return;
    const t = curTheme(), nt = { colors: [...t.colors], ball: t.ball };
    if (k === 'ball') nt.ball = e.target.value; else nt.colors[+k] = e.target.value;
    saveSettings({ theme: nt }); applyTheme(); unlock('theme');
    $('.theme-box').outerHTML = box(nt);
    $$('.preset').forEach(x => x.classList.remove('on'));
  });
  const fmt = Object.fromEntries(rows.map(r => [r[0], r[5]]));
  app.addEventListener('input', e => {
    const k = e.target.dataset.k; if (!k) return;
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? +e.target.value : e.target.value.trim().slice(0, 24);
    saveSettings({ [k]: v }); applyVolume();
    if (k === 'menuMusic' && !v) stopMusic(0.4);
    if (fmt[k]) $(`[data-v="${k}"]`).textContent = fmt[k](v);
  });
  // calibration
  let mode = 'audio', clicks = [], taps = [], result = null, raf = 0;
  $$('[data-cal]').forEach(b => b.onclick = () => { stopCal(); mode = b.dataset.cal; $$('[data-cal]').forEach(x => x.classList.toggle('on', x === b));
    $('[data-help]').textContent = mode === 'audio' ? 'Audio: we play 16 clicks. Tap on each one; the median gap becomes your audio offset, so judgement matches what you hear.' : 'Visual: the square flashes with each click. Drag the Visual offset slider until the flash and the click land together.';
    $('[data-cmsg]').textContent = mode === 'audio' ? 'Press Start, then tap any key on each click' : 'Press Start and watch the square'; });
  const sq = $('[data-sq]');
  function stopCal() { cancelAnimationFrame(raf); clicks = []; }
  $('[data-a=start]').onclick = () => {
    ctx(); stopMusic(0.2); stopCal(); taps = []; result = null; $('[data-taps]').innerHTML = ''; $('[data-res]').textContent = ''; $('[data-a=apply]').disabled = true;
    const t0 = ac.currentTime + 0.6, iv = 0.6, n = mode === 'audio' ? 16 : 40;
    for (let i = 0; i < n; i++) { clicks.push(t0 + i * iv); click(t0 + i * iv, i % 4 === 0); }
    $('[data-cmsg]').textContent = mode === 'audio' ? 'Tap on every click' : 'Watch, then adjust Visual offset';
    $('[data-pad]').focus();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = outNow() - (mode === 'visual' ? S.visualOffset / 1000 : 0);
      let f = 0; for (const c of clicks) { const d = now - c; if (d >= 0 && d < 0.25) f = 1 - d / 0.25; }
      sq.style.background = `rgba(25,240,255,${f * 0.9})`; sq.style.transform = `scale(${1 + f * 0.12})`;
      if (now > clicks[clicks.length - 1] + 0.5) { cancelAnimationFrame(raf); if (mode === 'audio') finishAudio(); else $('[data-cmsg]').textContent = 'Done. Press Start to watch again'; }
    };
    loop();
  };
  const onTap = e => {
    if (mode !== 'audio' || !clicks.length || e.repeat) return;
    if (e.type === 'keydown' && (e.target.matches('input') || e.key === 'Tab')) return;
    if (e.type === 'keydown') e.preventDefault();
    const t = outAt(e.timeStamp);
    let best = 1e9; for (const c of clicks) if (Math.abs(t - c) < Math.abs(best)) best = t - c;
    if (Math.abs(best) > 0.3) return;
    taps.push(best);
    $('[data-taps]').insertAdjacentHTML('beforeend', `<span>${best >= 0 ? '+' : ''}${Math.round(best * 1000)}</span>`);
  };
  $('[data-pad]').addEventListener('pointerdown', onTap);
  addEventListener('keydown', onTap);
  function finishAudio() {
    if (taps.length < 6) { $('[data-cmsg]').textContent = 'Need at least 6 taps. Try again'; return; }
    const s = [...taps].sort((a, b) => a - b), med = s[Math.floor(s.length / 2)];
    const spread = s[Math.floor(s.length * 0.8)] - s[Math.floor(s.length * 0.2)];
    result = Math.round(med * 1000);
    $('[data-res]').textContent = `Median ${result >= 0 ? '+' : ''}${result} ms · spread ${Math.round(spread * 1000)} ms`;
    $('[data-cmsg]').textContent = 'Apply to use this offset';
    $('[data-a=apply]').disabled = false;
  }
  $('[data-a=apply]').onclick = () => {
    if (result === null) return;
    saveSettings({ audioOffset: clamp(result, -250, 250) });
    $('[data-k=audioOffset]').value = S.audioOffset; $('[data-v=audioOffset]').textContent = S.audioOffset + ' ms';
    toast('Audio offset set to ' + S.audioOffset + ' ms');
  };
  closeScreen = () => { stopCal(); removeEventListener('keydown', onTap); };
}

// ---------- update log
const seenVersion = () => { try { return localStorage.getItem('bsq.seenVersion'); } catch { return null; } };
function updates() {
  try { localStorage.setItem('bsq.seenVersion', LATEST); } catch {}
  const tag = { new: ['New', 'down'], up: ['Improved', 'up'], fix: ['Fixed', 'left'] };
  app.innerHTML = `${bar('')}<section class="page">
    <div class="span-12 head" style="margin:0"><h2 class="sec-title">Update log</h2><span class="lbl">Current version ${LATEST}</span></div>
    ${CHANGELOG.map((r, i) => `<article class="span-12 frame pad" style="--c:var(--${['up', 'right', 'down', 'left'][i % 4]})">
      <div class="head"><span class="num" style="font-size:28px">v${r.v}</span><h3 class="disp" style="font-size:20px">${esc(r.title)}</h3><span class="lbl">${r.date}</span></div>
      <ul style="list-style:none;margin:0;padding:0;display:grid;gap:10px">${r.items.map(([k, t]) => `<li style="display:grid;grid-template-columns:84px 1fr;gap:12px;align-items:baseline"><span class="badge c-${tag[k][1]}">${tag[k][0]}</span><span>${esc(t)}</span></li>`).join('')}</ul>
    </article>`).join('')}
  </section>`;
}

// ---------- menu background: vector tunnel, beat rings, reacts to whatever is playing
const bg = $('#bg'), bgc = bg.getContext('2d');
let lastHomeBeat = -1;
let bgOn = true, bgW = 0, bgH = 0, rings = [], lastB = -1, lastT = performance.now(), attractEl = null, attract = null, homeNotes = [];
function bgResize() { const d = Math.min(2, devicePixelRatio || 1); bgW = innerWidth; bgH = innerHeight; bg.width = bgW * d; bg.height = bgH * d; bgc.setTransform(d, 0, 0, d, 0, 0); }
addEventListener('resize', bgResize); bgResize();
function bgFrame(ts) {
  requestAnimationFrame(bgFrame);
  if (!bgOn || document.hidden) return;
  const dt = Math.min(0.05, (ts - lastT) / 1000); lastT = ts;
  const [lo, mid] = energy();
  const bp = beatPos(), beats = bp !== null ? bp : ts / 1000 / 0.6, b = Math.floor(beats);
  if (b !== lastB) { lastB = b; rings.push({ s: 0.2, a: ((b % 4) + 4) % 4 === 0 ? 0.9 : 0.45 }); }
  const X = bgW * (bgW > 860 ? 0.72 : 0.5), Y = bgH * 0.55, base = Math.min(bgW, bgH) * 0.09;
  bgc.fillStyle = '#05050a'; bgc.fillRect(0, 0, bgW, bgH);
  if (homeBox && homeBox.isConnected) {
    const r = homeBox.getBoundingClientRect(), HX = r.left + r.width / 2, HY = r.top + r.height / 2, HB = r.width / 2;
    if (b !== lastHomeBeat) { lastHomeBeat = b; if (Math.random() < 0.8) homeNotes.push({ L: (Math.random() * 4) | 0, at: b + 2 }); }
    const farH = Math.hypot(bgW, bgH);
    bgc.lineWidth = 1; bgc.strokeStyle = '#151b2c'; bgc.globalAlpha = 0.8 + mid * 0.6;
    bgc.beginPath(); for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { bgc.moveTo(HX + cx * HB, HY + cy * HB); bgc.lineTo(HX + cx * farH, HY + cy * farH); } bgc.stroke(); bgc.globalAlpha = 1;
    for (const rr of rings) {
      rr.s += dt * (0.4 + rr.s * 0.7);
      const sz = HB * (1 + rr.s * 1.6), a = rr.a * Math.max(0, 1 - rr.s / 3) * (0.3 + lo * 1.2);
      bgc.strokeStyle = `rgba(58,76,122,${Math.min(0.85, a)})`; bgc.lineWidth = 1.5; bgc.strokeRect(HX - sz, HY - sz, sz * 2, sz * 2);
    }
    rings = rings.filter(rr => rr.s < 3);
    for (const n of homeNotes) {
      const p = n.at - beats;
      if (p <= 0) { n.done = true; homeFlash(n.L); continue; }
      const [dx, dy] = DIR[n.L], d = HB + 14 + p * Math.max(bgW, bgH) * 0.28, hw = HB * 0.42;
      bgc.fillStyle = COLORS[n.L]; bgc.globalAlpha = Math.min(0.75, 1.6 - p * 0.6);
      if (dx) bgc.fillRect(HX + dx * d - 3, HY - hw, 6, hw * 2); else bgc.fillRect(HX - hw, HY + dy * d - 3, hw * 2, 6);
    }
    bgc.globalAlpha = 1;
    homeNotes = homeNotes.filter(n => !n.done);
    return;
  }
  if (attractEl && attractEl.isConnected) {
    const r = attractEl.getBoundingClientRect();
    if (r.width > 40) {
      attract ||= new MiniScene(eqNow()); attract.eq = eqNow();
      attract.draw(bgc, { X: r.left + r.width / 2, Y: r.top + r.height / 2, B: r.width * 0.3, W: bgW, H: bgH }, dt, bp !== null ? bp % 100000 : null, energy());
      return;
    }
  }
  bgc.lineWidth = 1; bgc.strokeStyle = '#141a2a';
  const far = Math.hypot(bgW, bgH);
  bgc.beginPath(); for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { bgc.moveTo(X + cx * base, Y + cy * base); bgc.lineTo(X + cx * far, Y + cy * far); } bgc.stroke();
  for (const r of rings) {
    r.s += dt * (0.5 + r.s * 0.9);
    const s = base * (1 + r.s * 3), a = r.a * Math.max(0, 1 - r.s / 3) * (0.35 + lo * 1.2);
    bgc.strokeStyle = `rgba(58,76,122,${Math.min(0.9, a)})`; bgc.strokeRect(X - s, Y - s, s * 2, s * 2);
  }
  rings = rings.filter(r => r.s < 3);
  const ph = beats - b, pulse = Math.exp(-ph * 4);
  for (let L = 0; L < 4; L++) {
    bgc.strokeStyle = COLORS[L]; bgc.globalAlpha = 0.18 + pulse * 0.12 + mid * 0.4; bgc.lineWidth = 2;
    bgc.beginPath();
    if (L === 0) { bgc.moveTo(X - base, Y - base); bgc.lineTo(X + base, Y - base); }
    if (L === 1) { bgc.moveTo(X + base, Y - base); bgc.lineTo(X + base, Y + base); }
    if (L === 2) { bgc.moveTo(X + base, Y + base); bgc.lineTo(X - base, Y + base); }
    if (L === 3) { bgc.moveTo(X - base, Y + base); bgc.lineTo(X - base, Y - base); }
    bgc.stroke();
  }
  bgc.globalAlpha = 0.35 + pulse * 0.2; bgc.fillStyle = '#fff6a0'; bgc.beginPath(); bgc.arc(X, Y, base * 0.1, 0, 7); bgc.fill(); bgc.globalAlpha = 1;
}
requestAnimationFrame(bgFrame);

// ---------- CRT power-on (once per session), screen wipes, menu blips
const edges = Object.assign(document.createElement('div'), { id: 'edges', innerHTML: '<i></i><i></i><i></i><i></i>' }); document.body.appendChild(edges);
const wipeEl = Object.assign(document.createElement('div'), { id: 'wipe' }); document.body.appendChild(wipeEl);
function wipe() { wipeEl.classList.remove('go'); void wipeEl.offsetWidth; wipeEl.classList.add('go'); }
try { if (!sessionStorage.getItem('bsq.booted')) { sessionStorage.setItem('bsq.booted', '1'); const b = Object.assign(document.createElement('div'), { id: 'boot' }); document.body.appendChild(b); setTimeout(() => b.remove(), 1100); } } catch {}
const UI_SEL = '.btn, .rail a, .menu a, .ss-row, .ss-diff, .nav a, .preset, .shop-card, .tabs button, .seg button, .pchip, .cart';
let hoverEl = null;
document.addEventListener('pointerover', e => { const el = e.target.closest(UI_SEL); if (el && el !== hoverEl) { hoverEl = el; uiSound('hover'); } });
document.addEventListener('click', e => { const el = e.target.closest(UI_SEL); if (el) uiSound(el.matches('[href="#/"], [data-x], [data-a=quit]') ? 'back' : 'click'); }, true);
document.addEventListener('focusin', e => { if (e.target.matches?.('.menu a, .ss-row')) uiSound('hover'); });

route();
// warm the built-in track so the demo starts instantly
(window.requestIdleCallback || setTimeout)(() => renderDemo(), { timeout: 1500 });
