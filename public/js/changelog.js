// Update log, newest first. Shown at #/updates; the title screen flags a version you haven't seen.
export const CHANGELOG = [
  {
    v: '1.3', date: '2026-11-10', title: 'Menu music and a new song select',
    items: [
      ['new', 'The home screen plays a random song from the ones on this device, with Skip and Mute. The background rings pulse on its beat.'],
      ['new', 'New song select: a song wheel with search and sort, one row per song with difficulty pips and your best grade.'],
      ['new', 'Each song gets a generated jacket (or its cover art), difficulty tabs, a note-density graph and stats.'],
      ['up', 'Keys: ↑/↓ change song, ←/→ change difficulty, Enter plays, Shift+Enter autoplays, / searches.'],
      ['new', 'Settings has a Menu music on/off switch.'],
    ],
  },
  {
    v: '1.2', date: '2026-11-10', title: 'Packs and autoplay',
    items: [
      ['new', 'Autoplay: song select → “Autoplay · watch it” plays a chart perfectly on its own. It isn’t scored.'],
      ['new', '.bsq packs: one file with the song (mp3, mp4, wav or ogg) and every chart for it. Import from Play, export from song select or the editor.'],
      ['new', 'Re-importing a pack updates its charts instead of duplicating them.'],
      ['new', 'Song uploads accept mp4 files.'],
      ['new', 'This update log.'],
    ],
  },
  {
    v: '1.1', date: '2026-11-10', title: 'Better auto-charts',
    items: [
      ['up', 'Auto-chart finds onsets in each frequency band as well, so dense songs (rap, fast vocals) get fuller charts.'],
      ['up', 'Lanes follow each band’s energy relative to its own level, so kicks reach the Down lane more often and lanes are better balanced.'],
      ['up', 'Fewer quarter-beat jumps between opposite sides below Expert.'],
      ['new', 'Charts made from your own files ask for the song once and keep it in your browser. Nothing is uploaded.'],
      ['fix', 'The built-in track now prepares in the background, so the demo starts right away.'],
      ['fix', 'The chart fingerprint on song-select cards no longer covers the note count.'],
    ],
  },
  {
    v: '1.0', date: '2026-11-10', title: 'Launch',
    items: [
      ['new', 'Four-lane square gameplay with tap, hold, chord and Pierce notes.'],
      ['new', 'Perfect / Great / Good / Miss judging on the audio clock, plus combo, accuracy, grades and a full-combo badge.'],
      ['new', 'Level editor: waveform timeline, BPM detection, snapping, holds, chords, copy and paste, undo, slow playback, playtest from here, and JSON import/export.'],
      ['new', 'Auto-chart, Audius song search, song uploads, and a community catalog with likes, plays and leaderboards.'],
      ['new', 'Settings: offset calibration, note speed, volume, CRT bloom, shake and particles.'],
    ],
  },
];
export const LATEST = CHANGELOG[0].v;
