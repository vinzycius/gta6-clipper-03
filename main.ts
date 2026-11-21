// gta6-clipper-03 entry (Node 22, standard library only).
//
// The entry is the YouTube video itself: an AI agent found the GTA 6
// moment in Rockstar's Grand Theft Auto VI Launch Trailer (15 Oct 2026,
// https://www.youtube.com/watch?v=rz1B4B2yBZY), cut it into a vertical
// Short, pitched make.fun on screen, and handed it to be uploaded as a
// public Short. This program does two things:
//
//   1. Cut mode (local, when GTA6_CUT_FOOTAGE is set): it renders the
//      clip with ffmpeg from the trailer footage, following the cut list
//      below, and writes it to GTA6_CUT_OUT (default clip.mp4 next to
//      the footage). This is the program that made the clip.
//   2. Gate mode (always): it reads VIDEO.json from the repository root,
//      checks it really names a YouTube video, and writes it to the
//      output directory in canonical Shorts form, where the gate reads
//      it. That is all the gate needs; nothing it writes about the
//      video is scored.
//
// Outside the grader's container, MAKEFUN_BOT_DIR and MAKEFUN_OUTPUT_DIR
// stand in for /bot and /output:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
//   GTA6_CUT_FOOTAGE=footage/gta6-launch-trailer.mp4 node main.ts
//
// ---------------------------------------------------------------------------
// The creative (decided in the session that built this entry):
//
// The Launch Trailer's single most spectacular shot is the bank vault:
// two women step through a giant round vault door while debris and money
// fly through the air (trailer time ~34.5s). That is the hook — the
// first 1.2 seconds are pure spectacle, no slow scenery, no marina
// establishing shot. The rest of the moment is a sprint through the
// trailer's biggest action beats: the night fireball explosion, the
// dirt-bike jump off a rooftop, Lucia firing through an explosion and
// then jumping into the pool with Jason, the helicopter smashing its
// cargo through a tower's windows, the police chase, the pink biplane
// over the beach, Jason and Lucia by the red car, the pink club, and
// the sunset embrace that lands the emotion. Only then, after the best
// moment, comes the make.fun pitch: three short lines, four seconds
// each, over a dark blurred frame of the embrace.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// One moment of the trailer: [start seconds, duration seconds].
// Order is the order they appear in the clip, not trailer order.
const SEGMENTS: Array<[number, number, string]> = [
  [34.5, 1.2, 'vault hook: the round vault door, debris flying'],
  [52.3, 0.9, 'fireball: Jason with a rifle, explosion behind him'],
  [48.0, 2.4, 'bike jump: dirt bike off a rooftop'],
  [72.1, 3.5, 'rifle + pool jump: Lucia fires, then both jump in'],
  [67.9, 2.6, 'heli smash: cargo swung through tower windows'],
  [46.3, 1.7, 'police chase: green sports car, police closing in'],
  [54.5, 1.9, 'biplane: pink plane over the beach'],
  [39.8, 1.9, 'red car duo: Jason and Lucia by the red car'],
  [25.5, 1.9, 'convertible: Jason and Lucia cruising at sunset'],
  [44.4, 1.9, 'club: pink-lit dancer on stage'],
  [66.4, 1.4, 'embrace: Jason and Lucia at sunset'],
];

// The make.fun pitch: one line per 4 seconds, in order.
const PITCH_LINES = [
  'MAKE CLIPS LIKE THIS',
  'WITH AI - AND GET PAID',
  'MAKE.FUN',
];

const PITCH_SECONDS = 12;
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
// The pitch's background is a still of the embrace (trailer time 67.0),
// blurred and darkened; its audio is 12 seconds of the trailer's music
// (trailer time 24.0, the Vice City sunset drive), fading out at the end.
const PITCH_FRAME_AT = 67.0;
const PITCH_AUDIO_AT = 24.0;
const HOOK_CAPTION = 'THE VAULT BLEW OPEN';

// A YouTube video address: a Short, a watch page, or a youtu.be link.
// The video id is the 11-character token at the end of the address.
const VIDEO_URL =
  /^https:\/\/(www\.youtube\.com\/(shorts\/|watch\?v=)|youtu\.be\/)([A-Za-z0-9_-]{11})([?&#].*)?$/;

function loadVideoAddress(botDir: string): string | null {
  const raw = readFileSync(join(botDir, 'VIDEO.json'), 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || !('url' in parsed)) {
    throw new Error('VIDEO.json must be an object with a "url" string');
  }
  const url = (parsed as { url: unknown }).url;
  if (typeof url !== 'string') {
    throw new Error('VIDEO.json "url" must be a string');
  }
  // The starter's placeholder is not a video, but it is not this
  // program's job to refuse it: pass it through unchanged and let the
  // gate refuse it (valid 0), exactly as the starter's copy does. The
  // program must still complete, placeholder or not.
  if (url === 'https://www.youtube.com/shorts/<id>') {
    return null;
  }
  const match = VIDEO_URL.exec(url);
  if (!match) {
    throw new Error(`VIDEO.json does not name a YouTube video: ${url}`);
  }
  // Hand the gate one shape whatever the uploader pasted: the Shorts form.
  return `https://www.youtube.com/shorts/${match[3]}`;
}

function cutFilter(): string {
  const parts: string[] = [];
  SEGMENTS.forEach(([start, dur], i) => {
    const hook =
      i === 0
        ? `,drawtext=fontfile=${FONT}:text='${HOOK_CAPTION}':fontcolor=white:fontsize=72:borderw=6:bordercolor=black:x=(w-text_w)/2:y=h*0.40:enable='between(t,0.3,${dur})'`
        : '';
    parts.push(
      `[0:v]trim=start=${start}:duration=${dur},setpts=PTS-STARTPTS,crop=608:1080:656:0,scale=1080:1920:flags=lanczos,setsar=1,fps=30${hook}[v${i}]`,
    );
    parts.push(
      `[0:a]atrim=start=${start}:duration=${dur},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a${i}]`,
    );
  });
  // Pitch card: the embrace still, blurred and darkened, held 12 seconds,
  // with one pitch line on screen per 4-second window.
  const pitchDraw = PITCH_LINES.map((line, i) => {
    const big = i === PITCH_LINES.length - 1;
    const size = big ? 124 : 72;
    const color = big ? '0xff5da2' : 'white';
    const y = big ? 'h*0.42' : i === 0 ? 'h*0.40' : 'h*0.46';
    return (
      `drawtext=fontfile=${FONT}:text='${line}':fontcolor=${color}` +
      `:fontsize=${size}:box=1:boxcolor=black@0.45:boxborderw=24` +
      `:x=(w-text_w)/2:y=${y}:enable='between(t,${i * 4},${i * 4 + 4})'`
    );
  }).join(',');
  parts.push(
    `[0:v]trim=start=${PITCH_FRAME_AT}:duration=0.034,setpts=PTS-STARTPTS` +
      `,loop=loop=359:size=1:start=0,setpts=PTS-STARTPTS,fps=30` +
      `,crop=608:1080:656:0,scale=270:480,boxblur=12:2,scale=1080:1920:flags=bicubic` +
      `,eq=brightness=-0.22:saturation=0.6,setsar=1,${pitchDraw}[vb]`,
  );
  parts.push(
    `[0:a]atrim=start=${PITCH_AUDIO_AT}:duration=${PITCH_SECONDS}` +
      `,asetpts=PTS-STARTPTS,afade=t=out:st=10:d=2` +
      `,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[ap]`,
  );
  const n = SEGMENTS.length + 1;
  // concat takes each segment's video and audio together, in pairs:
  // [v0][a0][v1][a1]... — all videos first does not link.
  const pairs = SEGMENTS.map((_, i) => `[v${i}][a${i}]`).join('');
  parts.push(`${pairs}[vb][ap]concat=n=${n}:v=1:a=1[vout][aout]`);
  return parts.join(';\n');
}

function cutClip(footage: string, out: string): void {
  if (!existsSync(footage)) {
    throw new Error(`footage not found: ${footage}`);
  }
  if (!existsSync(FONT)) {
    throw new Error(`font not found: ${FONT}`);
  }
  mkdirSync(dirname(out), { recursive: true });
  const moment = SEGMENTS.reduce((sum, [, dur]) => sum + dur, 0);
  console.log(
    `gta6-clipper-03: cutting ${SEGMENTS.length} moments (${moment.toFixed(1)}s) ` +
      `+ ${PITCH_SECONDS}s pitch = ${(moment + PITCH_SECONDS).toFixed(1)}s total`,
  );
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      footage,
      '-filter_complex',
      cutFilter(),
      '-map',
      '[vout]',
      '-map',
      '[aout]',
      '-r',
      '30',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-ar',
      '48000',
      '-movflags',
      '+faststart',
      out,
    ],
    { stdio: 'inherit' },
  );
  console.log(`gta6-clipper-03: wrote ${out}`);
}

function main(): void {
  // Cut mode: render the clip from the trailer footage. This runs on the
  // agent's machine only; the grader never sets GTA6_CUT_FOOTAGE, so its
  // runs take the gate path below and need no footage or ffmpeg.
  const footage = process.env.GTA6_CUT_FOOTAGE;
  if (footage) {
    const out =
      process.env.GTA6_CUT_OUT ??
      join(dirname(footage), '..', 'clip.mp4');
    cutClip(footage, out);
  }
  // Gate mode: hand VIDEO.json to the gate in canonical Shorts form.
  const url = loadVideoAddress(BOT_DIR);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  // A placeholder passes through byte for byte; a real address is
  // written back in its canonical Shorts form.
  const out =
    url === null
      ? readFileSync(join(BOT_DIR, 'VIDEO.json'), 'utf8')
      : JSON.stringify({ url }) + '\n';
  writeFileSync(join(OUTPUT_DIR, 'VIDEO.json'), out, 'utf8');
}

try {
  main();
} catch (err) {
  console.error(`gta6-clipper-03: ${(err as Error).message}`);
  process.exit(1);
}
