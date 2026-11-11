// Beatsqare API Worker. Static files come from public/ (ASSETS); everything under /api/* lands here.
// D1 (DB): chart metadata, scores, likes, upload index. Audio: R2 (AUDIO) if bound, else KV (AUDIO_KV).

const AUDIUS = 'https://api.audius.co/v1';
const APP = 'app_name=beatsqare';
const MAX_UPLOAD = 24 * 1024 * 1024; // KV values cap at 25 MiB
const MAX_CHART = 900 * 1024;
const DIFFS = ['Easy', 'Normal', 'Hard', 'Expert'];

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...extra } });
const err = (msg, status = 400) => json({ error: msg }, status);
const rid = (n = 10) => {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789', b = crypto.getRandomValues(new Uint8Array(n));
  return [...b].map(x => a[x % a.length]).join('');
};
const clean = (s, n = 80) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
const handleOf = h => clean(h, 24).replace(/[^\w\-. ]/g, '') || 'anon';

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const p = url.pathname;
    try {
      if (!p.startsWith('/api/')) return env.ASSETS.fetch(req);
      const m = req.method;
      let r;
      // ---- charts
      if (p === '/api/charts' && m === 'GET') return listCharts(url, env);
      if (p === '/api/charts' && m === 'POST') return publishChart(req, env);
      if ((r = p.match(/^\/api\/charts\/([\w-]+)$/)) && m === 'GET') return getChart(r[1], env);
      if ((r = p.match(/^\/api\/charts\/([\w-]+)\/play$/)) && m === 'POST') {
        await env.DB.prepare('UPDATE charts SET plays = plays + 1 WHERE id = ?').bind(r[1]).run();
        return json({ ok: true });
      }
      if ((r = p.match(/^\/api\/charts\/([\w-]+)\/like$/)) && m === 'POST') return like(r[1], req, env);
      if ((r = p.match(/^\/api\/charts\/([\w-]+)\/scores$/)) && m === 'GET') return topScores(r[1], env);
      if ((r = p.match(/^\/api\/charts\/([\w-]+)\/scores$/)) && m === 'POST') return postScore(r[1], req, env);
      // ---- audio uploads
      if (p === '/api/upload' && m === 'POST') return upload(req, env);
      if ((r = p.match(/^\/api\/audio\/([\w-]+)$/)) && m === 'GET') return audio(r[1], env);
      // ---- Audius (proxied so the browser can decode the audio for waveform / BPM / auto-chart)
      if (p === '/api/audius/search' && m === 'GET') return audiusList(url, 'search', ctx);
      if (p === '/api/audius/trending' && m === 'GET') return audiusList(url, 'trending', ctx);
      if ((r = p.match(/^\/api\/audius\/stream\/(\w+)$/)) && m === 'GET') return audiusStream(r[1], req);
      if (p === '/api/health') return json({ ok: true, storage: env.AUDIO ? 'r2' : 'kv' });
      return err('not found', 404);
    } catch (e) {
      return err('server error: ' + (e && e.message || e), 500);
    }
  },
};

// ---------------- charts
async function listCharts(url, env) {
  const q = clean(url.searchParams.get('q'), 60);
  const diff = url.searchParams.get('diff');
  const sort = { plays: 'plays DESC', likes: 'likes DESC', new: 'created DESC' }[url.searchParams.get('sort')] || 'plays DESC';
  const limit = Math.min(50, +url.searchParams.get('limit') || 24);
  const offset = Math.max(0, +url.searchParams.get('offset') || 0);
  const where = [], args = [];
  if (q) { where.push('(title LIKE ?1 OR artist LIKE ?1 OR author LIKE ?1)'); args.push('%' + q.replace(/[%_]/g, '') + '%'); }
  if (DIFFS.includes(diff)) { where.push(`difficulty = ?${args.length + 1}`); args.push(diff); }
  const sql = `SELECT id,title,artist,author,difficulty,level,bpm,duration,notes,song_source,song_ref,song_license,song_credit,plays,likes,created
    FROM charts ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${sort}, created DESC LIMIT ${limit} OFFSET ${offset}`;
  const { results } = await env.DB.prepare(sql).bind(...args).all();
  return json({ charts: results });
}

async function getChart(id, env) {
  const row = await env.DB.prepare('SELECT * FROM charts WHERE id = ?').bind(id).first();
  if (!row) return err('chart not found', 404);
  const chart = JSON.parse(row.data);
  chart.catalogId = row.id;
  chart.plays = row.plays; chart.likes = row.likes; chart.author = row.author;
  return json(chart);
}

async function publishChart(req, env) {
  const text = await req.text();
  if (text.length > MAX_CHART) return err('chart too large');
  let c;
  try { c = JSON.parse(text); } catch { return err('bad json'); }
  if (!c || !Array.isArray(c.notes) || !c.notes.length) return err('chart has no notes');
  if (c.notes.length > 20000) return err('too many notes');
  const song = c.song || {};
  if (!['audius', 'upload', 'builtin'].includes(song.source) || !song.ref) return err('song must come from Audius, an upload or the built-in track');
  if (song.source === 'upload') {
    const up = await env.DB.prepare('SELECT id FROM uploads WHERE id = ?').bind(String(song.ref)).first();
    if (!up) return err('uploaded song not found');
  }
  const notes = c.notes.filter(n => Number.isFinite(n.t) && n.lane >= 0 && n.lane <= 3).map(n => {
    const o = { t: +n.t.toFixed(4), lane: n.lane | 0 };
    if (n.len > 0) o.len = +(+n.len).toFixed(4);
    if (n.type === 'pierce') o.type = 'pierce';
    return o;
  });
  const id = rid(8);
  const chart = {
    v: 1, title: clean(c.title) || 'Untitled', artist: clean(c.artist), author: handleOf(c.author),
    difficulty: DIFFS.includes(c.difficulty) ? c.difficulty : 'Normal', level: Math.max(1, Math.min(15, c.level | 0 || 5)),
    bpm: +c.bpm || 120, offset: +c.offset || 0, duration: +c.duration || 0,
    song: { source: song.source, ref: String(song.ref), license: clean(song.license, 120), credit: clean(song.credit, 160), link: clean(song.link, 300), art: clean(song.art, 300) },
    notes,
  };
  await env.DB.prepare(`INSERT INTO charts (id,title,artist,author,difficulty,level,bpm,duration,notes,song_source,song_ref,song_license,song_credit,data,created)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, chart.title, chart.artist, chart.author, chart.difficulty, chart.level, chart.bpm,
    chart.duration, notes.length, chart.song.source, chart.song.ref, chart.song.license, chart.song.credit, JSON.stringify(chart), Date.now()).run();
  return json({ id });
}

async function like(id, req, env) {
  const { handle } = await req.json().catch(() => ({}));
  const h = handleOf(handle);
  const ins = await env.DB.prepare('INSERT OR IGNORE INTO likes (chart_id, handle) VALUES (?, ?)').bind(id, h).run();
  let liked = true;
  if (ins.meta.changes) await env.DB.prepare('UPDATE charts SET likes = likes + 1 WHERE id = ?').bind(id).run();
  else { // second press = unlike
    await env.DB.batch([
      env.DB.prepare('DELETE FROM likes WHERE chart_id = ? AND handle = ?').bind(id, h),
      env.DB.prepare('UPDATE charts SET likes = MAX(0, likes - 1) WHERE id = ?').bind(id),
    ]);
    liked = false;
  }
  const row = await env.DB.prepare('SELECT likes FROM charts WHERE id = ?').bind(id).first();
  return json({ liked, likes: row ? row.likes : 0 });
}

async function topScores(id, env) {
  const { results } = await env.DB.prepare('SELECT handle,score,acc,combo,grade,fc,created FROM scores WHERE chart_id = ? ORDER BY score DESC LIMIT 10').bind(id).all();
  return json({ scores: results });
}

async function postScore(id, req, env) {
  const s = await req.json().catch(() => null);
  if (!s) return err('bad json');
  const score = Math.max(0, Math.min(1000000, s.score | 0));
  await env.DB.prepare(`INSERT INTO scores (chart_id,handle,score,acc,combo,grade,fc,created) VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(chart_id,handle) DO UPDATE SET score=excluded.score,acc=excluded.acc,combo=excluded.combo,grade=excluded.grade,fc=excluded.fc,created=excluded.created
    WHERE excluded.score > scores.score`).bind(id, handleOf(s.handle), score, Math.max(0, Math.min(100, +s.acc || 0)), s.combo | 0,
    clean(s.grade, 3), s.fc ? 1 : 0, Date.now()).run();
  return topScores(id, env);
}

// ---------------- audio
async function upload(req, env) {
  const len = +req.headers.get('content-length') || 0;
  if (!len) return err('empty upload');
  if (len > MAX_UPLOAD) return err('file is over 24 MB');
  const mime = (req.headers.get('content-type') || '').split(';')[0];
  if (!/^audio\//.test(mime) && mime !== 'application/ogg') return err('only audio files (mp3, ogg, wav)');
  const name = clean(decodeURIComponent(req.headers.get('x-file-name') || 'song'), 120);
  const id = rid(12);
  const body = await req.arrayBuffer();
  if (body.byteLength > MAX_UPLOAD) return err('file is over 24 MB');
  if (env.AUDIO) await env.AUDIO.put(id, body, { httpMetadata: { contentType: mime } });
  else await env.AUDIO_KV.put(id, body, { metadata: { mime } });
  await env.DB.prepare('INSERT INTO uploads (id,name,mime,size,handle,created) VALUES (?,?,?,?,?,?)')
    .bind(id, name, mime, body.byteLength, handleOf(req.headers.get('x-handle')), Date.now()).run();
  return json({ id, name, size: body.byteLength });
}

async function audio(id, env) {
  const headers = { 'cache-control': 'public, max-age=31536000, immutable' };
  if (env.AUDIO) {
    const obj = await env.AUDIO.get(id);
    if (!obj) return err('audio not found', 404);
    return new Response(obj.body, { headers: { ...headers, 'content-type': obj.httpMetadata?.contentType || 'audio/mpeg' } });
  }
  const { value, metadata } = await env.AUDIO_KV.getWithMetadata(id, { type: 'stream', cacheTtl: 86400 });
  if (!value) return err('audio not found', 404);
  return new Response(value, { headers: { ...headers, 'content-type': metadata?.mime || 'audio/mpeg' } });
}

// ---------------- Audius
function mapTrack(t) {
  const art = t.artwork || {};
  return {
    id: t.id, title: t.title, artist: t.user?.name || t.user?.handle || 'Unknown', handle: t.user?.handle || '',
    duration: t.duration || 0, genre: t.genre || '', bpm: t.bpm || null,
    license: t.license || 'All rights reserved', art: art['150x150'] || art['480x480'] || '',
    link: t.permalink ? 'https://audius.co' + t.permalink : '', plays: t.play_count || 0,
  };
}

async function audiusList(url, kind, ctx) {
  const q = clean(url.searchParams.get('q'), 80);
  const cc = url.searchParams.get('cc') === '1';
  const api = kind === 'search'
    ? `${AUDIUS}/tracks/search?query=${encodeURIComponent(q)}&limit=50&${APP}`
    : `${AUDIUS}/tracks/trending?limit=50${url.searchParams.get('genre') ? '&genre=' + encodeURIComponent(url.searchParams.get('genre')) : ''}&${APP}`;
  const cache = caches.default, key = new Request(api);
  let res = await cache.match(key);
  if (!res) {
    const r = await fetch(api, { headers: { accept: 'application/json' } });
    if (!r.ok) return err('Audius is not answering right now (' + r.status + ')', 502);
    res = new Response(await r.text(), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=600' } });
    ctx.waitUntil(cache.put(key, res.clone()));
  }
  const data = (await res.json()).data || [];
  let tracks = data.filter(t => !t.is_stream_gated && t.is_available !== false && !t.is_delete && t.duration > 20 && t.duration < 900).map(mapTrack);
  if (cc) tracks = tracks.filter(t => /CC|Creative Commons/i.test(t.license));
  return json({ tracks });
}

async function audiusStream(id, req) {
  const r = await fetch(`${AUDIUS}/tracks/${id}/stream?${APP}`, { redirect: 'follow', headers: { 'user-agent': 'beatsqare/1.0' } });
  if (!r.ok) return err('Audius stream unavailable (' + r.status + ')', 502);
  return new Response(r.body, {
    headers: { 'content-type': r.headers.get('content-type') || 'audio/mpeg', 'cache-control': 'public, max-age=86400', ...(r.headers.get('content-length') ? { 'content-length': r.headers.get('content-length') } : {}) },
  });
}
