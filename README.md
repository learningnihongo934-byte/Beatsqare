# Beatsqare

A four-sided rhythm game for the web. A glowing ball sits inside a square, notes fly in along four lanes, and you snap the ball to the side each note hits. It comes with a level editor, auto-charting, song search, uploads and a community catalog.

**Play:** https://beatsqare.rennko.tech

## How to play
- **Arrow keys or WASD** snap the ball to a side. Let go and it returns to the centre.
- **Two adjacent keys** send the ball to a corner, for chords.
- **On a phone**, swipe. A diagonal swipe goes to a corner. Drag back toward the start point to release without lifting your finger.
- **Esc / P** pauses.

| Note | What to do |
| --- | --- |
| Tap | Press the side as the bar reaches it |
| Hold | Press, then keep holding until the tail ends |
| Chord | Two sides at once (the dashed bracket) — ball goes to the corner |
| **Pierce** (original) | Enters from the *opposite* lane, flies through the box, and lands on the side whose colour it wears. Hit that side. |

Judgements: Perfect ±40 ms, Great ±70 ms, Good ±110 ms (the prototype's tight window), otherwise Miss. Score is out of 1,000,000 (90% accuracy, 10% max combo). Grades run SS / S / A / B / C / D, and a full combo earns a badge. Judging uses input timestamps mapped onto the Web Audio output clock, so it stays locked to the song. Settings has an audio offset (tap calibration), a visual offset and a note speed.

## Editor
- A waveform timeline with a beat grid. BPM and the first beat are detected automatically (spectral-flux onsets → autocorrelation → comb phase search), and both can be edited, or set with Tap tempo.
- Snap to 1/1, 1/2, 1/4 or 1/8. Click for a tap, drag right for a hold, shift-click for a chord, right-click to delete. A Pierce tool and a Select tool (box select, move by dragging) are included.
- Ctrl+C/X/V, undo/redo, playback at 0.5× and 0.75×, a metronome and note ticks. Number keys 1-4 place notes at the playhead.
- **Auto-chart** drafts a chart from onset detection at Easy/Normal/Hard/Expert, using per-band energy for lanes, sustain for holds and accents for chords.
- **Playtest from here**, JSON export/import, and **Publish** to the online catalog.

## .bsq packs
A `.bsq` file is one song plus every chart for it, like an osu! `.osz`. It holds `BSQPACK1` (8 bytes), a uint32 LE header length, a UTF-8 JSON header (`format: "beatsqare-pack"`, title, artist, audio name/mime/size, `charts: [...]`), and then the raw audio bytes (mp3, mp4, wav or ogg).
- **Import:** Play → *Import .bsq or chart JSON*. The audio stays in your browser; re-importing the same pack updates its charts instead of duplicating them.
- **Export:** *Export .bsq* in song select or the editor bundles the song with every chart on this device that uses it.

**Videos:** a pack can also carry the song's video (the header's `video` field; the bytes come after the audio and cover). Uploading an mp4 keeps its video, and *Edit info* attaches one to any song. Turn on **Background video** in Settings (or with the Video button on song select) and it plays dimmed behind the notes, synced to the song. To add a video to an existing pack: `node tools/bsq-video.mjs "Song.bsq" "Song.mp4"`.

**Autoplay** (song select → *Autoplay · watch it*) plays a chart perfectly by itself. It doesn't count toward your best score or the leaderboard.

## Songs
- **Built-in:** "Square One", a 128 BPM track synthesized in the browser with an OfflineAudioContext. The game ships no audio files.
- **Audius** for search and discovery. It's free with no key, no account and no card, and its official API is meant for third-party players to stream from. (Jamendo needs a registered client id.) Every track shows its artist, its license and a link back to Audius, and a "Creative Commons only" filter is available.
- **Uploads** (mp3/ogg/wav, up to 24 MB) are stored online so charts made with them play on any device.
- Songs download only when you pick them, and are then cached in IndexedDB, like osu! beatmaps. A chart is just note data plus a track reference.

## Stack
Everything runs on the Cloudflare free plan, with no payment card.
- **Worker** (`src/worker.js`): the API, plus static assets from `public/`.
- **D1** (`beatsqare`): charts, scores, likes and the upload index. The schema is in `migrations/`.
- **Audio storage:** KV (`AUDIO_KV`), because R2 requires a payment method before it can be enabled. Adding an `AUDIO` R2 binding in `wrangler.jsonc` switches uploads to R2 with no code changes.
- **Frontend:** plain ES modules, Canvas 2D (cheap downsample bloom, no shadowBlur) and Web Audio, with no build step. Fonts are Tourney and Martian Mono.
- **Routing:** the domain has a specific `beatsqare.rennko.tech/*` route, so Rennko Cloud's `*.rennko.tech` wildcard doesn't capture it.

```sh
./build.sh dev      # local server on :8790 with local D1/KV
./build.sh deploy   # migrate D1 + publish to beatsqare.rennko.tech
./build.sh check    # syntax check
```

Update log: [CHANGELOG.md](CHANGELOG.md), also in the game at `#/updates`.

Prototype: `~/Documents/BeatSquare/index.html`. The tuning comes from it (ball ease k=45, 1.4 s approach at speed 5, ±110 ms window).

Made by **Virat Reddy Kaukuntla** ([@learningnihongo934-byte](https://github.com/learningnihongo934-byte))
