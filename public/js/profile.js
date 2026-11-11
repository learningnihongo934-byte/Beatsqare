// Player profile (this device): tokens, XP / level, owned + equipped cosmetics, lifetime stats, achievements, daily challenge.
import { toast, esc, getSettings, saveSettings, applyTheme, THEMES } from './util.js';
import { ITEMS, DEFAULTS, item } from './cosmetics.js';

const KEY = 'bsq.profile';
const blank = () => ({ xp: 0, tokens: 150, owned: [], eq: { ...DEFAULTS }, stats: { plays: 0, clears: 0, fcs: 0, aps: 0, notes: 0, seconds: 0, maxCombo: 0, grades: {}, dailies: 0 }, ach: {}, daily: null, lastDay: '', recent: [] });
let P;
try { P = { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; P.eq = { ...DEFAULTS, ...P.eq }; P.stats = { ...blank().stats, ...P.stats }; } catch { P = blank(); }
export const profile = () => P;
function save() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch {} dispatchEvent(new CustomEvent('bsq:profile')); }

// ---------- levels: level n needs 400·(n−1)^1.45 total XP
export const xpFor = n => Math.round(400 * Math.pow(Math.max(0, n - 1), 1.45));
export function levelOf(xp = P.xp) { let n = 1; while (xpFor(n + 1) <= xp) n++; return { level: n, into: xp - xpFor(n), need: xpFor(n + 1) - xpFor(n) }; }

// ---------- shop
export const owns = id => { const it = item(id); return !!it && (it.price === 0 && !it.ach || P.owned.includes(id) || (it.ach && !!P.ach[it.ach])); };
export const equipped = slot => P.eq[slot] || DEFAULTS[slot];
export function buy(id) {
  const it = item(id);
  if (!it || owns(id)) return 'owned';
  if (it.ach) return 'locked';
  if (P.tokens < it.price) return 'poor';
  P.tokens -= it.price; P.owned.push(id); save();
  unlock('shop_1');
  return 'ok';
}
export function equip(id) {
  const it = item(id);
  if (!it || !owns(id)) return false;
  P.eq[it.slot] = id; save();
  if (it.slot === 'theme') {
    const t = it.colors ? { colors: [...it.colors], ball: it.ball } : { colors: [...THEMES[it.theme || 0].colors], ball: THEMES[it.theme || 0].ball };
    saveSettings({ theme: t }); applyTheme();
  }
  return true;
}
export const ownedThemes = () => ITEMS.filter(i => i.slot === 'theme' && i.colors && owns(i.id));

// ---------- achievements
export const ACH = [
  { id: 'first_clear', name: 'First Credit', desc: 'Clear any chart.', reward: 50 },
  { id: 'fc_1', name: 'No Drops', desc: 'Get a full combo.', reward: 150 },
  { id: 'ap_1', name: 'Spotless', desc: 'Clear a chart with every note Perfect.', reward: 400 },
  { id: 's_rank', name: 'S-Class', desc: 'Get an S or better.', reward: 150 },
  { id: 'combo_100', name: 'Centurion', desc: 'Reach a 100 combo.', reward: 80 },
  { id: 'combo_500', name: 'Long Haul', desc: 'Reach a 500 combo.', reward: 250 },
  { id: 'combo_1000', name: 'Unbroken', desc: 'Reach a 1,000 combo.', reward: 500 },
  { id: 'plays_10', name: 'Regular', desc: 'Play 10 times.', reward: 100 },
  { id: 'plays_50', name: 'Cabinet Rat', desc: 'Play 50 times.', reward: 300 },
  { id: 'plays_200', name: 'Arcade Royalty', desc: 'Play 200 times.', reward: 800 },
  { id: 'notes_10k', name: 'Ten Thousand Taps', desc: 'Hit 10,000 notes.', reward: 300 },
  { id: 'notes_50k', name: 'Fifty Thousand', desc: 'Hit 50,000 notes.', reward: 800 },
  { id: 'hard_a', name: 'Sharp', desc: 'Get an A or better on a Hard chart.', reward: 150 },
  { id: 'expert_clear', name: 'Expert Witness', desc: 'Clear an Expert chart with a C or better.', reward: 250 },
  { id: 'long', name: 'Marathon', desc: 'Clear a song longer than 5 minutes.', reward: 200 },
  { id: 'tempo', name: 'Shifting Gears', desc: 'Clear a chart with tempo changes.', reward: 150 },
  { id: 'night', name: 'Night Shift', desc: 'Play between midnight and 4 a.m.', reward: 75 },
  { id: 'daily_1', name: 'Daily Driver', desc: 'Complete a daily challenge.', reward: 100 },
  { id: 'daily_7', name: 'Seven Days', desc: 'Complete 7 daily challenges.', reward: 500 },
  { id: 'chart_made', name: 'Cartographer', desc: 'Save a chart with 50+ notes in the editor.', reward: 150 },
  { id: 'publish', name: 'Broadcast', desc: 'Publish a chart to the catalog.', reward: 200 },
  { id: 'pack_import', name: 'Care Package', desc: 'Import a .bsq pack.', reward: 50 },
  { id: 'shop_1', name: 'Window Shopper', desc: 'Buy something at the prize counter.', reward: 50 },
  { id: 'theme', name: 'Repaint', desc: 'Change the colour theme.', reward: 30 },
];
export function unlock(id) {
  if (P.ach[id]) return null;
  const a = ACH.find(x => x.id === id); if (!a) return null;
  P.ach[id] = Date.now(); P.tokens += a.reward; save();
  toast(`Achievement: ${a.name} · +${a.reward} tokens`);
  return a;
}

// ---------- daily challenge: one chart from your library + a goal, same all day
const today = () => new Date().toISOString().slice(0, 10);
const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export function daily(charts) {
  const d = today();
  if (P.daily && P.daily.date === d) { if (!P.daily.title) { const c = charts.find(x => x.id === P.daily.chartId); if (c) P.daily.title = c.title; } return P.daily; }
  const pool = charts.filter(c => c.notes && c.notes.length >= 30);
  if (!pool.length) return null;
  const h = hash(d), c = pool[h % pool.length];
  const goals = [
    { type: 'grade', value: 'A', text: 'Get an A or better' },
    { type: 'combo', value: Math.max(30, Math.min(400, Math.round(c.notes.length * 0.35 / 10) * 10)), text: '' },
    { type: 'acc', value: 92, text: 'Finish with 92% accuracy or more' },
    { type: 'fc', value: 1, text: 'Get a full combo' },
  ];
  const goal = goals[(h >>> 8) % (c.notes.length > 600 ? 3 : 4)];
  if (goal.type === 'combo') goal.text = `Reach a ${goal.value} combo`;
  P.daily = { date: d, chartId: c.id, title: c.title, difficulty: c.difficulty, goal, reward: 150, done: false };
  save();
  return P.daily;
}
const GR = { SS: 6, S: 5, A: 4, B: 3, C: 2, D: 1 };

// ---------- rewards after a real play (not autoplay / playtest / partial)
export function reward(r, chart) {
  const out = { tokens: 0, xp: 0, lines: [], ach: [], levelUp: null, daily: false };
  const hit = r.perfect + r.great + r.good, counted = hit + r.miss;
  if (!counted) return out;
  const before = levelOf().level;
  const gm = { SS: 2, S: 1.6, A: 1.3, B: 1.1, C: 1, D: 0.6 }[r.grade] || 1;
  const add = (label, n) => { if (n > 0) { out.tokens += n; out.lines.push([label, n]); } };
  add('Notes hit', Math.max(5, Math.round(hit / 15 * gm)));
  if (r.fc) add(r.grade === 'SS' ? 'All perfect' : 'Full combo', r.grade === 'SS' ? 80 : 30);
  if (P.lastDay !== today()) { add('First play today', 50); P.lastDay = today(); }
  if (r.newBest) add('New best', 20);
  out.xp = Math.round(r.sumW + (r.fc ? counted * 0.2 : 0));
  // stats
  const s = P.stats, cleared = r.grade !== 'D';
  s.plays++; s.notes += hit; s.seconds += Math.round(chart.duration || 0); s.maxCombo = Math.max(s.maxCombo, r.maxCombo);
  if (cleared) s.clears++; if (r.fc) s.fcs++; if (r.grade === 'SS') s.aps++;
  s.grades[r.grade] = (s.grades[r.grade] || 0) + 1;
  P.recent = [{ title: chart.title, difficulty: chart.difficulty, grade: r.grade, score: r.score, at: Date.now() }, ...(P.recent || [])].slice(0, 8);
  // daily
  const dl = P.daily;
  if (dl && dl.date === today() && !dl.done && dl.chartId === chart.id) {
    const g = dl.goal;
    const ok = g.type === 'grade' ? GR[r.grade] >= GR[g.value] : g.type === 'combo' ? r.maxCombo >= g.value : g.type === 'acc' ? r.acc >= g.value : r.fc;
    if (ok) { dl.done = true; s.dailies++; add('Daily challenge', dl.reward); out.daily = true; }
  }
  P.tokens += out.tokens; P.xp += out.xp;
  const after = levelOf().level;
  if (after > before) { const bonus = 100 * (after - before); P.tokens += bonus; out.lines.push([`Level ${after}`, bonus]); out.tokens += bonus; out.levelUp = { from: before, to: after }; }
  save();
  // achievements
  const tryA = (id, cond) => { if (cond) { const a = unlock(id); if (a) out.ach.push(a); } };
  tryA('first_clear', cleared); tryA('fc_1', r.fc); tryA('ap_1', r.grade === 'SS'); tryA('s_rank', GR[r.grade] >= 5);
  tryA('combo_100', r.maxCombo >= 100); tryA('combo_500', r.maxCombo >= 500); tryA('combo_1000', r.maxCombo >= 1000);
  tryA('plays_10', s.plays >= 10); tryA('plays_50', s.plays >= 50); tryA('plays_200', s.plays >= 200);
  tryA('notes_10k', s.notes >= 10000); tryA('notes_50k', s.notes >= 50000);
  tryA('hard_a', chart.difficulty === 'Hard' && GR[r.grade] >= 4); tryA('expert_clear', chart.difficulty === 'Expert' && GR[r.grade] >= 2);
  tryA('long', cleared && (chart.duration || 0) > 300); tryA('tempo', cleared && Array.isArray(chart.timing) && chart.timing.length > 1);
  tryA('night', new Date().getHours() < 4); tryA('daily_1', s.dailies >= 1); tryA('daily_7', s.dailies >= 7);
  return out;
}

// token glyph: a square coin
export const TOKEN = '<svg class="tok-ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="5.5" y="5.5" width="5" height="5" fill="currentColor"/></svg>';
export const fmtTok = n => (n | 0).toLocaleString('en-US');
export const titleName = () => item(equipped('title'))?.name || 'Rookie';
export { esc };
