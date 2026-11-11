# Update log

Also in the game at `#/updates`.

## v1.5 — Tempo changes, themes and song names (2026-11-11)

- **New:** Themes: Settings → Theme has presets (Vector, Sunset, Ocean, Phosphor, Amber, Sakura) and a colour picker for each side and the ball. It applies to the game, editor and menus.
- **New:** Edit info on song select renames a song’s title and artist, even when the file or pack already named it.
- **New:** Uploading a song reads its title and artist from the file’s tags (or a cleaned-up file name) and lets you edit them first.
- **New:** Cover art: songs show their real cover on the jacket. It’s taken from the mp3’s embedded image on upload or import, or set with Edit info → Choose image / From song file. .bsq packs carry the cover too.
- **New:** Timing points: a chart can change tempo. The beat pulse, menu rings, editor grid, snapping, bar numbers and metronome follow each section.
- **New:** Detect finds tempo changes by itself: it scans the song in windows and splits it where the tempo really changes, not just where a section feels half-time.
- **New:** Editor: + Tempo / − Tempo add or remove a section at the playhead. BPM and first beat edit the section under the playhead, and each change is marked in the ruler.
- **Improved:** Auto-chart charts each tempo section on its own grid.
- **Improved:** Timing points are kept in .bsq packs, JSON export and published charts. Song select shows a BPM range like 105.5–135.

## v1.4 — Sharper BPM detection (2026-11-10)

- **Improved:** BPM detection scores every tempo from 70 to 200 on both beats and half-beats. That fixes half-time and triplet mix-ups like 80 vs 120 and 106 vs 160. It was checked against six real songs.
- **Improved:** The first beat now locks onto the kick and snare, not offbeat hi-hats.
- **New:** Import several .bsq or JSON files at once from song select.

## v1.3 — Menu music and a new song select (2026-11-10)

- **New:** The home screen plays a random song from the ones on this device, with Skip and Mute. The background rings pulse on its beat.
- **New:** New song select: a song wheel with search and sort, one row per song with difficulty pips and your best grade.
- **New:** Each song gets a generated jacket (or its cover art), difficulty tabs, a note-density graph and stats.
- **Improved:** Keys: ↑/↓ change song, ←/→ change difficulty, Enter plays, Shift+Enter autoplays, / searches.
- **New:** Settings has a Menu music on/off switch.

## v1.2 — Packs and autoplay (2026-11-10)

- **New:** Autoplay: song select → “Autoplay · watch it” plays a chart perfectly on its own. It isn’t scored.
- **New:** .bsq packs: one file with the song (mp3, mp4, wav or ogg) and every chart for it. Import from Play, export from song select or the editor.
- **New:** Re-importing a pack updates its charts instead of duplicating them.
- **New:** Song uploads accept mp4 files.
- **New:** This update log.

## v1.1 — Better auto-charts (2026-11-10)

- **Improved:** Auto-chart finds onsets in each frequency band as well, so dense songs (rap, fast vocals) get fuller charts.
- **Improved:** Lanes follow each band’s energy relative to its own level, so kicks reach the Down lane more often and lanes are better balanced.
- **Improved:** Fewer quarter-beat jumps between opposite sides below Expert.
- **New:** Charts made from your own files ask for the song once and keep it in your browser. Nothing is uploaded.
- **Fixed:** The built-in track now prepares in the background, so the demo starts right away.
- **Fixed:** The chart fingerprint on song-select cards no longer covers the note count.

## v1.0 — Launch (2026-11-10)

- **New:** Four-lane square gameplay with tap, hold, chord and Pierce notes.
- **New:** Perfect / Great / Good / Miss judging on the audio clock, plus combo, accuracy, grades and a full-combo badge.
- **New:** Level editor: waveform timeline, BPM detection, snapping, holds, chords, copy and paste, undo, slow playback, playtest from here, and JSON import/export.
- **New:** Auto-chart, Audius song search, song uploads, and a community catalog with likes, plays and leaderboards.
- **New:** Settings: offset calibration, note speed, volume, CRT bloom, shake and particles.
