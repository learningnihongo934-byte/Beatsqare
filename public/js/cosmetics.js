// Cosmetics: the shop catalogue and every drawable variant (ball, trail, hit effect, note, frame, background),
// shared by the game, the shop preview and the title screen's attract-mode box.
import { DIR, COLORS, BALL } from './util.js';

// ---------- catalogue (price 0 = free default; ach = unlocked by that achievement instead of tokens)
export const SLOTS = [
  ['ball', 'Ball'], ['trail', 'Trail'], ['hit', 'Hit effect'], ['note', 'Notes'], ['frame', 'Box frame'],
  ['bg', 'Background'], ['sound', 'Hit sound'], ['theme', 'Theme'], ['title', 'Title'],
];
export const ITEMS = [
  { id: 'ball.orb', slot: 'ball', name: 'Orb', price: 0, desc: 'The original glowing ball.' },
  { id: 'ball.ring', slot: 'ball', name: 'Halo', price: 250, desc: 'A hollow ring with a bright core.' },
  { id: 'ball.diamond', slot: 'ball', name: 'Diamond', price: 400, desc: 'A spinning cut gem.' },
  { id: 'ball.star', slot: 'ball', name: 'Star', price: 600, desc: 'Five points, slowly turning.' },
  { id: 'ball.pixel', slot: 'ball', name: 'Pixel', price: 300, desc: 'One fat square pixel. No anti-aliasing.' },
  { id: 'ball.planet', slot: 'ball', name: 'Planet', price: 900, desc: 'A small world with its own moon.' },
  { id: 'ball.comet', slot: 'ball', name: 'Comet', price: 1200, desc: 'A burning head with a long tail.' },
  { id: 'trail.short', slot: 'trail', name: 'Afterimage', price: 0, desc: 'A short fading echo.' },
  { id: 'trail.none', slot: 'trail', name: 'None', price: 0, desc: 'Clean. No trail at all.' },
  { id: 'trail.ribbon', slot: 'trail', name: 'Ribbon', price: 350, desc: 'A smooth tapered ribbon.' },
  { id: 'trail.sparks', slot: 'trail', name: 'Sparks', price: 500, desc: 'Sheds sparks as it moves.' },
  { id: 'trail.prism', slot: 'trail', name: 'Prism', price: 800, desc: 'Echoes in all four side colours.' },
  { id: 'hit.sparks', slot: 'hit', name: 'Sparks', price: 0, desc: 'A spray of square sparks.' },
  { id: 'hit.shock', slot: 'hit', name: 'Shockwave', price: 400, desc: 'Square shockwaves off the side.' },
  { id: 'hit.confetti', slot: 'hit', name: 'Confetti', price: 600, desc: 'Every hit is a party.' },
  { id: 'hit.bolt', slot: 'hit', name: 'Lightning', price: 900, desc: 'Forked bolts crack outward.' },
  { id: 'hit.petals', slot: 'hit', name: 'Petals', price: 700, desc: 'Petals drift off the box.' },
  { id: 'note.bar', slot: 'note', name: 'Bars', price: 0, desc: 'Solid bars with a bright core.' },
  { id: 'note.chevron', slot: 'note', name: 'Chevrons', price: 450, desc: 'Arrows that point at the box.' },
  { id: 'note.dots', slot: 'note', name: 'Dot rows', price: 350, desc: 'A row of glowing dots.' },
  { id: 'note.double', slot: 'note', name: 'Twin line', price: 300, desc: 'Two thin parallel lines.' },
  { id: 'note.pill', slot: 'note', name: 'Capsules', price: 500, desc: 'Rounded capsules.' },
  { id: 'frame.line', slot: 'frame', name: 'Vector', price: 0, desc: 'One crisp glowing line per side.' },
  { id: 'frame.double', slot: 'frame', name: 'Double', price: 350, desc: 'An outer and inner line.' },
  { id: 'frame.corners', slot: 'frame', name: 'Brackets', price: 450, desc: 'Just the corners. Minimal.' },
  { id: 'frame.tube', slot: 'frame', name: 'Neon tube', price: 700, desc: 'Thick tubes with a white-hot core.' },
  { id: 'frame.dashed', slot: 'frame', name: 'Dashed', price: 300, desc: 'Marching dashes.' },
  { id: 'bg.tunnel', slot: 'bg', name: 'Tunnel', price: 0, desc: 'Rails and beat rings.' },
  { id: 'bg.void', slot: 'bg', name: 'Void', price: 0, desc: 'Nothing. Just you and the box.' },
  { id: 'bg.stars', slot: 'bg', name: 'Starfield', price: 600, desc: 'Fly through stars that speed up with the bass.' },
  { id: 'bg.horizon', slot: 'bg', name: 'Grid floor', price: 700, desc: 'A vector floor rolling toward you.' },
  { id: 'bg.rain', slot: 'bg', name: 'Signal rain', price: 650, desc: 'Falling dashes in the side colours.' },
  { id: 'sound.blip', slot: 'sound', name: 'Blip', price: 0, desc: 'The classic pitched blip.' },
  { id: 'sound.clap', slot: 'sound', name: 'Clap', price: 300, desc: 'A tight hand clap.' },
  { id: 'sound.wood', slot: 'sound', name: 'Woodblock', price: 300, desc: 'A dry wooden knock.' },
  { id: 'sound.glass', slot: 'sound', name: 'Glass', price: 450, desc: 'A small glass chime.' },
  { id: 'sound.coin', slot: 'sound', name: 'Coin', price: 500, desc: 'Two-note arcade coin.' },
  { id: 'theme.vector', slot: 'theme', name: 'Vector', price: 0, theme: 0, desc: 'The house colours.' },
  { id: 'theme.gold', slot: 'theme', name: 'Gold Rush', price: 800, desc: 'Brass, gold and warm white.', colors: ['#ffd36b', '#ffae3d', '#fff0b3', '#e08a2e'], ball: '#ffffff' },
  { id: 'theme.ice', slot: 'theme', name: 'Ice', price: 800, desc: 'Cold blues and frost.', colors: ['#bdf3ff', '#6fc8ff', '#e8fbff', '#7a9dff'], ball: '#ffffff' },
  { id: 'theme.blood', slot: 'theme', name: 'Blood Moon', price: 1000, desc: 'Reds and a pale moon ball.', colors: ['#ff3b3b', '#ff2b6e', '#ff7a5c', '#b3002d'], ball: '#ffe7d6' },
  { id: 'theme.vapor', slot: 'theme', name: 'Vapor', price: 1000, desc: 'Teal, pink and lilac.', colors: ['#5ef2e0', '#ff71ce', '#b967ff', '#fffb96'], ball: '#ffffff' },
  { id: 'title.rookie', slot: 'title', name: 'Rookie', price: 0, desc: 'Everyone starts somewhere.' },
  { id: 'title.keeper', slot: 'title', name: 'Beat Keeper', price: 250, desc: 'A title for steady hands.' },
  { id: 'title.corner', slot: 'title', name: 'Corner Specialist', price: 400, desc: 'Chords fear you.' },
  { id: 'title.square', slot: 'title', name: 'Square One', price: 600, desc: 'Back to basics, forever.' },
  { id: 'title.spotless', slot: 'title', name: 'Spotless', ach: 'ap_1', desc: 'Earned with an all-perfect clear.' },
  { id: 'title.unbroken', slot: 'title', name: 'Unbroken', ach: 'combo_1000', desc: 'Earned with a 1,000 combo.' },
  { id: 'title.nightowl', slot: 'title', name: 'Night Owl', ach: 'night', desc: 'Earned by playing between midnight and 4 a.m.' },
  { id: 'title.carto', slot: 'title', name: 'Cartographer', ach: 'chart_made', desc: 'Earned by building a chart.' },
  { id: 'title.rat', slot: 'title', name: 'Cabinet Rat', ach: 'plays_50', desc: 'Earned with 50 plays.' },
  { id: 'title.royal', slot: 'title', name: 'Arcade Royalty', ach: 'plays_200', desc: 'Earned with 200 plays.' },
];
export const item = id => ITEMS.find(i => i.id === id);
export const DEFAULTS = Object.fromEntries(SLOTS.map(([s]) => [s, ITEMS.find(i => i.slot === s && i.price === 0).id]));
const kind = id => (id || '').split('.')[1];

// ---------- backgrounds
export function drawBg(g, id, s) {
  const k = kind(id), { X, Y, B, W, H, dt } = s, st = s.state;
  if (k === 'void') return;
  if (k === 'stars') {
    st.stars ||= Array.from({ length: 140 }, () => ({ a: Math.random() * 6.283, d: Math.random(), z: 0.2 + Math.random() }));
    const sp = (0.25 + s.eLow * 1.6 + s.pulse * 0.4) * dt;
    for (const p of st.stars) {
      p.d += sp * p.z * (0.3 + p.d);
      if (p.d > 1.2) { p.d = 0.02; p.a = Math.random() * 6.283; }
      const r = B * 1.1 + p.d * Math.hypot(W, H) * 0.5, x = X + Math.cos(p.a) * r, y = Y + Math.sin(p.a) * r, l = 2 + p.d * 14 * (0.5 + s.eLow);
      g.strokeStyle = '#c9d6ff'; g.globalAlpha = Math.min(0.8, p.d * 0.9); g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(p.a) * l, y - Math.sin(p.a) * l); g.stroke();
    }
    g.globalAlpha = 1; return;
  }
  if (k === 'horizon') {
    const hy = Y + B * 1.05, base = H;
    st.scroll = ((st.scroll || 0) + dt * (0.6 + s.eLow * 1.5)) % 1;
    g.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const z = (i + st.scroll) / 14, y = hy + (base - hy) * z * z;
      g.strokeStyle = COLORS[1]; g.globalAlpha = 0.08 + z * 0.35 + s.pulse * 0.1;
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    for (let i = -10; i <= 10; i++) {
      g.strokeStyle = COLORS[0]; g.globalAlpha = 0.12 + s.eMid * 0.3;
      g.beginPath(); g.moveTo(X + i * B * 0.18, hy); g.lineTo(X + i * W * 0.16, base); g.stroke();
    }
    g.globalAlpha = 1; return;
  }
  if (k === 'rain') {
    st.drops ||= Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), v: 0.2 + Math.random() * 0.6, c: Math.floor(Math.random() * 4) }));
    for (const d of st.drops) {
      d.y += d.v * dt * (0.6 + s.eMid * 1.4);
      if (d.y > 1.05) { d.y = -0.05; d.x = Math.random(); }
      g.strokeStyle = COLORS[d.c]; g.globalAlpha = 0.18 + s.eHigh * 0.4; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(d.x * W, d.y * H); g.lineTo(d.x * W, d.y * H + 10 + d.v * 22); g.stroke();
    }
    g.globalAlpha = 1; return;
  }
  // tunnel (default): rails + rings that spawn on each beat
  const far = Math.hypot(W, H) / 2;
  g.strokeStyle = '#1b2236'; g.lineWidth = 1; g.globalAlpha = 0.6 + s.eMid * 0.8;
  g.beginPath();
  for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.moveTo(X + cx * B, Y + cy * B); g.lineTo(X + cx * far, Y + cy * far); }
  g.stroke(); g.globalAlpha = 1;
  st.rings ||= [];
  if (s.newBeat) st.rings.push({ s: 1, a: s.bar ? 1 : 0.55 });
  for (const r of st.rings) {
    r.s += dt * 1.6 / s.beatLen * 0.5 * (1 + r.s * 0.6);
    const sz = B * r.s, a = r.a * Math.max(0, 1 - (r.s - 1) / 4) * (0.25 + s.eLow * 1.1);
    if (a <= 0.01) continue;
    g.strokeStyle = '#3a4c7a'; g.globalAlpha = Math.min(0.9, a); g.lineWidth = 1.5;
    g.strokeRect(X - sz, Y - sz, sz * 2, sz * 2);
  }
  g.globalAlpha = 1;
  st.rings = st.rings.filter(r => r.s < 5);
}

// ---------- box frame (one side)
function glow(g, col, w, a) {
  g.strokeStyle = col; g.globalAlpha = a * 0.25; g.lineWidth = w * 3.2; g.stroke();
  g.globalAlpha = a; g.lineWidth = w; g.stroke(); g.globalAlpha = 1;
}
function seg(g, X, Y, B, L, a0, a1, inset = 0) { // part of side L from fraction a0 to a1 along it
  const [dx, dy] = DIR[L], b = B - inset;
  g.beginPath();
  if (dx) { g.moveTo(X + dx * b, Y - B + 2 * B * a0); g.lineTo(X + dx * b, Y - B + 2 * B * a1); }
  else { g.moveTo(X - B + 2 * B * a0, Y + dy * b); g.lineTo(X - B + 2 * B * a1, Y + dy * b); }
}
export function drawSide(g, id, X, Y, B, L, col, w, a, ext = 0, t = 0) {
  const k = kind(id), e = ext / (2 * B);
  if (k === 'double') { seg(g, X, Y, B, L, -e, 1 + e); glow(g, col, w * 0.6, a); seg(g, X, Y, B, L, 0.06, 0.94, 7); glow(g, col, Math.max(1, w * 0.35), a * 0.7); return; }
  if (k === 'corners') { seg(g, X, Y, B, L, -e, 0.28); glow(g, col, w, a); seg(g, X, Y, B, L, 0.72, 1 + e); glow(g, col, w, a); return; }
  if (k === 'tube') {
    seg(g, X, Y, B, L, -e, 1 + e); g.lineCap = 'round';
    glow(g, col, w * 2.2, a * 0.8); g.strokeStyle = '#ffffff'; g.globalAlpha = a * 0.85; g.lineWidth = Math.max(1, w * 0.5); g.stroke();
    g.globalAlpha = 1; g.lineCap = 'square'; return;
  }
  if (k === 'dashed') { g.setLineDash([10, 7]); g.lineDashOffset = -t * 30; seg(g, X, Y, B, L, -e, 1 + e); glow(g, col, w, a); g.setLineDash([]); return; }
  seg(g, X, Y, B, L, -e, 1 + e); glow(g, col, w, a);
}

// ---------- tap note at distance d from the centre on side L
export function drawTap(g, id, X, Y, L, d, hw, col, alpha) {
  const k = kind(id), [dx, dy] = DIR[L], th = 7;
  const px = X + dx * d, py = Y + dy * d;
  g.globalAlpha = alpha; g.fillStyle = col; g.strokeStyle = col;
  if (k === 'chevron') {
    g.lineWidth = 3; g.beginPath();
    for (const o of [-6, 4]) {
      if (dx) { g.moveTo(px + dx * (o + 10), py - hw); g.lineTo(px + dx * o, py); g.lineTo(px + dx * (o + 10), py + hw); }
      else { g.moveTo(px - hw, py + dy * (o + 10)); g.lineTo(px, py + dy * o); g.lineTo(px + hw, py + dy * (o + 10)); }
    }
    g.stroke();
  } else if (k === 'dots') {
    for (let i = -2; i <= 2; i++) { const o = i * hw / 2.2; g.beginPath(); g.arc(dx ? px : px + o, dy ? py : py + o, 4.2, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; g.globalAlpha = alpha * 0.8;
    for (let i = -2; i <= 2; i++) { const o = i * hw / 2.2; g.beginPath(); g.arc(dx ? px : px + o, dy ? py : py + o, 1.6, 0, 7); g.fill(); }
  } else if (k === 'double') {
    if (dx) { g.fillRect(px - 5, py - hw, 2.5, hw * 2); g.fillRect(px + 2.5, py - hw, 2.5, hw * 2); }
    else { g.fillRect(px - hw, py - 5, hw * 2, 2.5); g.fillRect(px - hw, py + 2.5, hw * 2, 2.5); }
  } else if (k === 'pill') {
    const wv = dx ? 10 : hw * 2, hv = dx ? hw * 2 : 10, x0 = px - wv / 2, y0 = py - hv / 2, r = 5;
    g.beginPath(); g.moveTo(x0 + r, y0); g.arcTo(x0 + wv, y0, x0 + wv, y0 + hv, r); g.arcTo(x0 + wv, y0 + hv, x0, y0 + hv, r); g.arcTo(x0, y0 + hv, x0, y0, r); g.arcTo(x0, y0, x0 + wv, y0, r); g.closePath();
    g.globalAlpha = alpha * 0.35; g.fill(); g.globalAlpha = alpha; g.lineWidth = 2; g.stroke();
  } else {
    if (dx) g.fillRect(px - th / 2, py - hw, th, hw * 2); else g.fillRect(px - hw, py - th / 2, hw * 2, th);
    g.fillStyle = '#ffffff'; g.globalAlpha = alpha * 0.7;
    if (dx) g.fillRect(px - 1, py - hw + 2, 2, hw * 2 - 4); else g.fillRect(px - hw + 2, py - 1, hw * 2 - 4, 2);
  }
  g.globalAlpha = 1;
}

// ---------- ball + trail. pts = recent screen positions, newest first.
export function drawBall(g, ballId, trailId, pts, r, t, parts) {
  const k = kind(ballId), tk = kind(trailId), [cx, cy] = pts[0];
  g.lineCap = 'round';
  if (k === 'comet' || tk === 'ribbon') {
    const n = k === 'comet' ? pts.length : Math.min(pts.length, 10);
    for (let i = 1; i < n; i++) {
      const f = 1 - i / n; g.strokeStyle = BALL; g.globalAlpha = f * (k === 'comet' ? 0.7 : 0.45); g.lineWidth = r * 2 * f;
      g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); g.stroke();
    }
  } else if (tk === 'short' || tk === 'prism') {
    const n = Math.min(pts.length, 7);
    for (let i = n - 1; i >= 1; i--) {
      g.globalAlpha = (1 - i / n) * (tk === 'prism' ? 0.6 : 0.25); g.fillStyle = tk === 'prism' ? COLORS[i % 4] : BALL;
      g.beginPath(); g.arc(pts[i][0], pts[i][1], r * (1 - i / 10), 0, 7); g.fill();
    }
  }
  if (tk === 'sparks' && parts && pts.length > 1 && Math.hypot(cx - pts[1][0], cy - pts[1][1]) > 3 && parts.length < 400)
    for (let i = 0; i < 2; i++) parts.push({ t: 'sq', x: cx, y: cy, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, life: 0.6, c: Math.random() < 0.5 ? BALL : COLORS[(Math.random() * 4) | 0], s: 1.5 + Math.random() * 1.5 });
  g.lineCap = 'square';
  g.globalAlpha = 0.28; g.fillStyle = BALL; g.beginPath(); g.arc(cx, cy, r * 2.2, 0, 7); g.fill(); g.globalAlpha = 1;
  if (k === 'ring') {
    g.strokeStyle = '#fffbe0'; g.lineWidth = Math.max(2, r * 0.35); g.beginPath(); g.arc(cx, cy, r * 1.05, 0, 7); g.stroke();
    g.fillStyle = '#fffbe0'; g.beginPath(); g.arc(cx, cy, r * 0.32, 0, 7); g.fill();
  } else if (k === 'diamond') {
    const a = t * 2; g.fillStyle = '#fffbe0'; g.beginPath();
    for (let i = 0; i < 4; i++) { const ang = a + i * Math.PI / 2, rr = i % 2 ? r * 0.8 : r * 1.3; g.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr); }
    g.closePath(); g.fill();
  } else if (k === 'star') {
    const a = t * 0.8; g.fillStyle = '#fffbe0'; g.beginPath();
    for (let i = 0; i < 10; i++) { const ang = a + i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.55 : r * 1.35; g.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr); }
    g.closePath(); g.fill();
  } else if (k === 'pixel') {
    const s2 = Math.round(r * 1.7); g.fillStyle = '#fffbe0'; g.fillRect(Math.round(cx - s2 / 2), Math.round(cy - s2 / 2), s2, s2);
  } else if (k === 'planet') {
    g.fillStyle = '#fffbe0'; g.beginPath(); g.arc(cx, cy, r * 0.9, 0, 7); g.fill();
    g.strokeStyle = BALL; g.globalAlpha = 0.6; g.lineWidth = 1.2; g.beginPath(); g.ellipse(cx, cy, r * 1.9, r * 0.6, -0.4, 0, 7); g.stroke(); g.globalAlpha = 1;
    const ma = t * 3; g.fillStyle = COLORS[0]; g.beginPath(); g.arc(cx + Math.cos(ma) * r * 1.9 * Math.cos(-0.4) - Math.sin(ma) * r * 0.6 * Math.sin(-0.4), cy + Math.cos(ma) * r * 1.9 * Math.sin(-0.4) + Math.sin(ma) * r * 0.6 * Math.cos(-0.4), r * 0.3, 0, 7); g.fill();
  } else if (k === 'comet') {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, r * 1.05, 0, 7); g.fill();
  } else {
    g.fillStyle = '#fffbe0'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  }
}

// ---------- hit effects → particles
export function spawnHit(id, parts, x, y, ang, col, j, B, horizontal) {
  const k = kind(id), many = j === 'perfect';
  const room = () => parts.length < 500;
  if (k === 'shock') {
    parts.push({ t: 'ring', x, y, s: B * 0.3, v: B * 2.2, life: 1, c: col, w: many ? 3 : 2, horizontal });
    if (many) parts.push({ t: 'ring', x, y, s: B * 0.1, v: B * 1.4, life: 1, c: '#fff', w: 1.5, horizontal });
    return;
  }
  if (k === 'bolt') {
    for (let i = 0; i < (many ? 4 : 2); i++) {
      const a = ang + (Math.random() - 0.5) * 1.6, pts = [[x, y]]; let px = x, py = y;
      for (let s = 0; s < 6; s++) { px += Math.cos(a) * B * 0.12 + (Math.random() - 0.5) * B * 0.1; py += Math.sin(a) * B * 0.12 + (Math.random() - 0.5) * B * 0.1; pts.push([px, py]); }
      parts.push({ t: 'bolt', pts, life: 1, c: Math.random() < 0.4 ? '#fff' : col });
    }
    return;
  }
  const n = many ? 18 : 10;
  for (let i = 0; i < n && room(); i++) {
    const a = ang + (Math.random() - 0.5) * 2.2, sp = 120 + Math.random() * 420;
    const ox = horizontal ? (Math.random() - 0.5) * B : 0, oy = horizontal ? 0 : (Math.random() - 0.5) * B;
    if (k === 'confetti') parts.push({ t: 'conf', x: x + ox, y: y + oy, vx: Math.cos(a) * sp * 0.8, vy: Math.sin(a) * sp * 0.8 - 80, life: 1.4, c: COLORS[(Math.random() * 4) | 0], s: 3 + Math.random() * 3, r: Math.random() * 6, vr: (Math.random() - 0.5) * 14 });
    else if (k === 'petals') parts.push({ t: 'petal', x: x + ox, y: y + oy, vx: Math.cos(a) * sp * 0.4, vy: Math.sin(a) * sp * 0.4, life: 1.6, c: Math.random() < 0.5 ? '#ffd1e8' : col, s: 3 + Math.random() * 3, r: Math.random() * 6, vr: (Math.random() - 0.5) * 5 });
    else parts.push({ t: 'sq', x: x + ox, y: y + oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, c: Math.random() < 0.3 ? '#fff' : col, s: 1 + Math.random() * 2.5 });
  }
}
export function stepParts(g, parts, dt) {
  g.globalCompositeOperation = 'lighter';
  for (const p of parts) {
    if (p.t === 'ring') {
      p.s += p.v * dt; p.v *= 0.9; p.life -= dt * 2.2; if (p.life <= 0) continue;
      g.strokeStyle = p.c; g.globalAlpha = p.life; g.lineWidth = p.w;
      const w2 = p.horizontal ? p.s * 2.4 : p.s * 0.6, h2 = p.horizontal ? p.s * 0.6 : p.s * 2.4;
      g.strokeRect(p.x - w2 / 2, p.y - h2 / 2, w2, h2); continue;
    }
    if (p.t === 'bolt') {
      p.life -= dt * 4; if (p.life <= 0) continue;
      g.strokeStyle = p.c; g.globalAlpha = p.life; g.lineWidth = 2; g.beginPath(); p.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); continue;
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.t === 'conf') { p.vx *= 0.94; p.vy = p.vy * 0.94 + 420 * dt; p.r += p.vr * dt; p.life -= dt * 1.1; }
    else if (p.t === 'petal') { p.vx = p.vx * 0.96 + Math.sin(p.r) * 30 * dt; p.vy = p.vy * 0.96 + 60 * dt; p.r += p.vr * dt; p.life -= dt * 0.9; }
    else { p.vx *= 0.9; p.vy *= 0.9; p.life -= dt * 2.4; }
    if (p.life <= 0) continue;
    g.globalAlpha = Math.min(1, p.life); g.fillStyle = p.c;
    if (p.t === 'conf' || p.t === 'petal') {
      g.save(); g.translate(p.x, p.y); g.rotate(p.r);
      if (p.t === 'petal') { g.beginPath(); g.ellipse(0, 0, p.s * 1.3, p.s * 0.6, 0, 0, 7); g.fill(); } else g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      g.restore();
    } else g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
  }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

// ---------- self-running demo box (shop preview, title attract mode)
// eq: { ball, trail, hit, note, frame, bg } item ids. clock(): beats (float) or null for an internal 120 BPM clock.
export class MiniScene {
  constructor(eq) { this.eq = eq; this.state = {}; this.parts = []; this.notes = []; this.ball = { x: 0, y: 0 }; this.pts = []; this.flash = [0, 0, 0, 0]; this.lastBeat = -1; this.t = 0; this.hold = null; this.target = [0, 0]; this.release = 0; }
  draw(g, box, dt, beats, energy = [0, 0, 0]) {
    const { X, Y, B, W, H } = box, eq = this.eq;
    this.t += dt;
    const b = beats ?? this.t * 2, bi = Math.floor(b), phase = b - bi, pulse = Math.exp(-phase * 5);
    const newBeat = bi !== this.lastBeat; if (newBeat) this.lastBeat = bi;
    if (this.next !== undefined && Math.abs(b - this.next) > 8) { this.next = Math.ceil(b); this.notes = []; }
    // schedule notes two beats ahead
    while ((this.next ?? (this.next = Math.ceil(b))) < b + 2) {
      const r = Math.random(), lane = (Math.random() * 4) | 0;
      if (r < 0.75) this.notes.push({ at: this.next, lane });
      if (r < 0.18) this.notes.push({ at: this.next, lane: (lane + 1) % 4 });
      if (Math.random() < 0.35) this.notes.push({ at: this.next + 0.5, lane: (lane + 2) % 4 });
      this.next += 1;
    }
    drawBg(g, eq.bg, { X, Y, B, W, H, dt, state: this.state, newBeat, bar: bi % 4 === 0, beatLen: 0.5, pulse, eLow: energy[0], eMid: energy[1], eHigh: energy[2] });
    for (let L = 0; L < 4; L++) {
      drawSide(g, eq.frame, X, Y, B, L, COLORS[L], 2.5 + pulse, 0.8 + pulse * 0.2, 0, this.t);
      if (this.flash[L] > 0.02) { drawSide(g, eq.frame, X, Y, B, L, '#ffffff', 2.5 + 5 * this.flash[L], this.flash[L], 4 * this.flash[L], this.t); this.flash[L] *= Math.exp(-dt * 9); }
    }
    const sp = B * 1.6;
    for (const n of this.notes) {
      if (n.done) continue;
      const d = B + 6 + (n.at - b) * sp;
      if (n.at <= b) {
        n.done = true; this.flash[n.lane] = 1;
        const [dx, dy] = DIR[n.lane];
        spawnHit(eq.hit, this.parts, X + dx * B, Y + dy * B, Math.atan2(dy, dx), COLORS[n.lane], Math.random() < 0.7 ? 'perfect' : 'great', B, !dx);
        const same = this.notes.filter(m => !m.done && Math.abs(m.at - n.at) < 0.01);
        const ls = [n.lane, ...same.map(m => m.lane)];
        this.target = ls.length > 1 ? [DIR[ls[0]][0] + DIR[ls[1]][0], DIR[ls[0]][1] + DIR[ls[1]][1]] : DIR[n.lane];
        this.release = b + 0.3;
        continue;
      }
      if (d < Math.max(W, H)) drawTap(g, eq.note, X, Y, n.lane, d, B * 0.5, COLORS[n.lane], 1);
    }
    this.notes = this.notes.filter(n => !n.done);
    if (b > this.release) this.target = [0, 0];
    const k = 1 - Math.exp(-dt * 45);
    this.ball.x += (this.target[0] - this.ball.x) * k; this.ball.y += (this.target[1] - this.ball.y) * k;
    const r = B * 0.09, reach = B - r - 5;
    this.pts.unshift([X + this.ball.x * reach, Y + this.ball.y * reach]); if (this.pts.length > 18) this.pts.pop();
    drawBall(g, eq.ball, eq.trail, this.pts, r, this.t, this.parts);
    stepParts(g, this.parts, dt);
  }
}
