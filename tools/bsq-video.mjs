#!/usr/bin/env node
// Add (or replace) the background video inside a .bsq pack.
//   node tools/bsq-video.mjs "Song.bsq" "Song.mp4" [out.bsq]     (out defaults to overwriting the pack)
import fs from 'fs';
import path from 'path';
const [packPath, videoPath, outPath = packPath] = process.argv.slice(2);
if (!packPath || !videoPath) { console.error('usage: node tools/bsq-video.mjs <pack.bsq> <video.mp4|webm> [out.bsq]'); process.exit(1); }
const buf = fs.readFileSync(packPath);
if (buf.subarray(0, 8).toString('ascii') !== 'BSQPACK1') { console.error('not a .bsq pack'); process.exit(1); }
const n = buf.readUInt32LE(8), header = JSON.parse(buf.subarray(12, 12 + n).toString('utf8'));
let p = 12 + n;
const audioSize = header.audio?.size ?? (buf.length - p - (header.art?.size || 0) - (header.video?.size || 0));
const audio = buf.subarray(p, p + audioSize); p += audioSize;
const art = header.art ? buf.subarray(p, p + header.art.size) : null;
const video = fs.readFileSync(videoPath), ext = path.extname(videoPath).slice(1).toLowerCase();
header.audio = { ...(header.audio || {}), size: audio.length };
header.video = { mime: { webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/mp4' }[ext] || 'video/mp4', size: video.length };
const hj = Buffer.from(JSON.stringify(header)), len = Buffer.alloc(4); len.writeUInt32LE(hj.length);
fs.writeFileSync(outPath, Buffer.concat([Buffer.from('BSQPACK1'), len, hj, audio, ...(art ? [art] : []), video]));
console.log(`${path.basename(outPath)}: ${header.charts.length} charts, audio ${(audio.length / 1048576).toFixed(1)} MB${art ? ', cover' : ''}, video ${(video.length / 1048576).toFixed(1)} MB`);
