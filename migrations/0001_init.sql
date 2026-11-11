CREATE TABLE charts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT 'anon',
  difficulty TEXT NOT NULL DEFAULT 'Normal',
  level INTEGER NOT NULL DEFAULT 5,
  bpm REAL NOT NULL DEFAULT 120,
  duration REAL NOT NULL DEFAULT 0,
  notes INTEGER NOT NULL DEFAULT 0,
  song_source TEXT NOT NULL,
  song_ref TEXT NOT NULL,
  song_license TEXT NOT NULL DEFAULT '',
  song_credit TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL,
  plays INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);
CREATE INDEX charts_plays ON charts(plays DESC);
CREATE INDEX charts_likes ON charts(likes DESC);
CREATE INDEX charts_created ON charts(created DESC);
CREATE TABLE scores (
  chart_id TEXT NOT NULL,
  handle TEXT NOT NULL,
  score INTEGER NOT NULL,
  acc REAL NOT NULL,
  combo INTEGER NOT NULL,
  grade TEXT NOT NULL,
  fc INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  PRIMARY KEY (chart_id, handle)
);
CREATE INDEX scores_top ON scores(chart_id, score DESC);
CREATE TABLE likes (chart_id TEXT NOT NULL, handle TEXT NOT NULL, PRIMARY KEY (chart_id, handle));
CREATE TABLE uploads (id TEXT PRIMARY KEY, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, handle TEXT NOT NULL, created INTEGER NOT NULL);
