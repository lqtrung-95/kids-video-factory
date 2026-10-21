/**
 * Step 4 — the song.
 *   npx tsx scripts/04-song.ts <slug>
 *
 * 1st run (no song yet): writes content/<slug>.mureka-lyrics.txt + .mureka-style.txt.
 *     → In Mureka (paid plan = commercial rights): Create → Custom → paste lyrics + style,
 *       pick the best take, download MP3 to public/<slug>/song.mp3
 * 2nd run (song present): aligns lyrics to the audio (scripts/align.py) and re-times every
 *     lyric scene so scene cuts land on the lines and karaoke follows the singer.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, assetDir, audioSeconds, load, log, rel, save } from "./lib";
import { MUSIC_STYLES, murekaLyrics, pickStyle } from "./music";

const slug = process.argv[2];
if (!slug) throw new Error("Usage: tsx scripts/04-song.ts <slug>");
const v = load(slug);
const lyricIdx = v.scenes.flatMap((s, i) => (s.type === "lyric" ? [i] : []));
if (!lyricIdx.length) throw new Error("No lyric scenes");
const contiguous = lyricIdx.every((x, k) => k === 0 || x === lyricIdx[k - 1] + 1);
if (!contiguous) throw new Error("Lyric scenes must be consecutive (one song block)");

const lyricsFile = path.join(ROOT, "content", `${slug}.lyrics.txt`);
const lines = lyricIdx.flatMap((i) => (v.scenes[i] as Extract<(typeof v.scenes)[number], { type: "lyric" }>).lines.map((l) => l.text));
fs.writeFileSync(lyricsFile, lines.join("\n") + "\n");

const song = path.join(assetDir(slug), "song.mp3");

// what to paste into Mureka (or Suno): lyrics with [Verse]/[Chorus] tags + this video's music style
const style = pickStyle(v, slug);
if (v.meta.musicStyle !== style) {
  v.meta.musicStyle = style;
  save(slug, v);
}
fs.writeFileSync(path.join(ROOT, "content", `${slug}.mureka-lyrics.txt`), murekaLyrics(v));
fs.writeFileSync(path.join(ROOT, "content", `${slug}.mureka-style.txt`), MUSIC_STYLES[style] + "\n");

if (!fs.existsSync(song)) {
  log(`music style: ${style}`);
  log(`Mureka → Create → Custom: paste content/${slug}.mureka-lyrics.txt into Lyrics and content/${slug}.mureka-style.txt into Style,`);
  log(`pick the best take (≈1:05–1:25, all lines sung), download MP3 → public/${slug}/song.mp3, then run this step again.`);
  process.exit(0);
}

const alignOut = path.join(ROOT, "content", `${slug}.align.json`);
const songLen = audioSeconds(song);
type Aligned = { lines: { words: { w: string; start: number; end: number }[] }[] };

/** No stable-ts? Spread the lines evenly over the song (intro/outro guessed) so a preview still works. */
const roughTiming = (): Aligned => {
  const intro = Number(process.env.SONG_INTRO ?? Math.min(6, songLen * 0.08));
  const outro = Number(process.env.SONG_OUTRO ?? Math.min(4, songLen * 0.06));
  const words = lines.map((l) => l.split(/\s+/));
  const n = words.reduce((a, w) => a + w.length, 0);
  const per = (songLen - intro - outro) / n;
  let t = intro;
  return {
    lines: words.map((ws) => ({
      words: ws.map((w) => {
        const o = { w, start: +t.toFixed(3), end: +(t + per).toFixed(3) };
        t += per;
        return o;
      }),
    })),
  };
};

/** An isolated vocals stem (Demucs or Suno stems) makes every alignment method much more accurate. */
const findVocals = (): string | undefined => {
  const dir = assetDir(slug);
  const direct = path.join(dir, "vocals.wav");
  if (fs.existsSync(direct)) return direct;
  const walk = (d: string): string | undefined => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        const r = walk(p);
        if (r) return r;
      } else if (/^vocals\.(wav|mp3|flac)$/i.test(e.name)) return p;
    }
  };
  return walk(dir);
};
const mtime = (f: string) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0);
const songTime = mtime(song);
const py0 = process.env.PYTHON ?? "python3";
const instrumentalFile = path.join(assetDir(slug), "instrumental.mp3");

/**
 * New song.mp3 dropped in? Stems from the previous song would silently ruin the timing, so:
 * re-run Demucs on the new song (if installed) → fresh vocals.wav + instrumental.mp3;
 * otherwise ignore the stale stems and say so.
 */
let vocals = findVocals();
if (!vocals || mtime(vocals) < songTime) {
  const stale = !!vocals;
  try {
    log(`${stale ? "vocals stem is from an older song —" : "no vocals stem —"} separating the new song with Demucs (a minute or two)…`);
    execFileSync(py0, ["-m", "demucs", "--two-stems=vocals", "-o", path.join(assetDir(slug), "separated"), song], {
      stdio: "inherit",
      env: { ...process.env, KMP_DUPLICATE_LIB_OK: "TRUE" },
    });
    vocals = findVocals();
    if (vocals && mtime(vocals) < songTime) vocals = undefined;
  } catch {
    log(`⚠ Demucs not available (pip install demucs) — ${stale ? "ignoring the old vocals stem" : "continuing without a vocals stem"}.`);
    vocals = undefined;
  }
}
// the instrumental for the learning part should come from the same song
if (vocals && mtime(instrumentalFile) < songTime) {
  const noVocals = path.join(path.dirname(vocals), "no_vocals.wav");
  if (fs.existsSync(noVocals)) {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", noVocals, "-b:a", "192k", instrumentalFile]);
    log("instrumental.mp3 updated from the new song");
  }
} else if (mtime(instrumentalFile) && mtime(instrumentalFile) < songTime) {
  log("⚠ instrumental.mp3 is from an older song — the learning part will use it until you replace it");
}
const py = process.env.PYTHON ?? "python3";

let aligned: Aligned & { vocal_end?: number };
let method = "cached";
if (fs.existsSync(alignOut) && mtime(alignOut) > songTime && !process.argv.includes("--force")) {
  aligned = JSON.parse(fs.readFileSync(alignOut, "utf8"));
} else {
  try {
    // ALIGNER=vocals skips Whisper entirely (e.g. when stable-ts crashes on this machine)
    if (process.env.ALIGNER === "vocals") throw new Error("ALIGNER=vocals");
    // 1) Whisper forced alignment — word-accurate (needs: pip install -U stable-ts)
    log(`aligning lyrics with stable-ts on ${vocals ? "the vocals stem" : "the full mix"}…`);
    execFileSync(py, [path.join(ROOT, "scripts", "align.py"), vocals ?? song, lyricsFile, alignOut], {
      stdio: "inherit",
      env: { ...process.env, KMP_DUPLICATE_LIB_OK: "TRUE" },
    });
    aligned = JSON.parse(fs.readFileSync(alignOut, "utf8"));
    method = "stable-ts";
  } catch {
    if (vocals) {
      // 2) no model needed: loudness of the vocals stem → line timing (±0.2 s)
      log(process.env.ALIGNER === "vocals" ? "ALIGNER=vocals — timing from the vocals stem." : "stable-ts failed or isn't installed (see error above) — timing from the vocals stem instead.");
      const tmp = path.join(ROOT, "content", `${slug}.align-vocals.json`);
      // the instrumental stem next to it gives a cleaner tempo than the voice
      const noVocals = path.join(path.dirname(vocals), "no_vocals.wav");
      const args = [path.join(ROOT, "scripts", "align_vocals.py"), vocals, lyricsFile, tmp];
      if (fs.existsSync(noVocals)) args.push(noVocals);
      execFileSync(py, args, { stdio: "inherit" });
      aligned = JSON.parse(fs.readFileSync(tmp, "utf8"));
      method = "vocals-stem";
    } else {
      // 3) last resort: even spacing
      log("⚠ no stable-ts and no vocals stem — using rough even timing (karaoke will drift).");
      log("  fix: pip install -U stable-ts, or separate vocals: demucs --two-stems=vocals song.mp3");
      aligned = roughTiming();
      method = "rough";
    }
  }
}

// When the singing stops, stop the song part too (Suno often adds a long instrumental tail).
const lastWordEnd = aligned.vocal_end ?? Math.max(...aligned.lines.flatMap((l) => l.words.map((w) => w.end)), 0);
const TAIL = Number(process.env.SONG_TAIL ?? 2.5);
const songCut = method !== "rough" && songLen - lastWordEnd > TAIL + 2 ? Math.min(songLen, lastWordEnd + TAIL) : songLen;

// first sung word of each lyric scene
let li = 0;
const firstWord: number[] = [];
const perScene = lyricIdx.map((i) => {
  const s = v.scenes[i] as Extract<(typeof v.scenes)[number], { type: "lyric" }>;
  const ls = s.lines.map(() => aligned.lines[li++]);
  firstWord.push(ls[0]?.words[0]?.start ?? 0);
  return ls;
});

// Scene cut between lyric scenes: ideally LEAD seconds before the next scene's first word, but
// never before this scene's last word has had HOLD seconds on screen (legato lines run into
// each other, and cutting early skipped the last word's highlight).
const LEAD = 0.45;
const HOLD = 0.3;
const lastStart = perScene.map((ls) => Math.max(0, ...ls.flatMap((l) => (l?.words ?? []).map((w) => w.start))));
const cut = (k: number) => Math.min(Math.max(firstWord[k + 1] - LEAD, lastStart[k] + HOLD), firstWord[k + 1] - 0.02);
lyricIdx.forEach((i, k) => {
  const s = v.scenes[i] as Extract<(typeof v.scenes)[number], { type: "lyric" }>;
  const t0 = k === 0 ? 0 : Math.max(0, cut(k - 1));
  const t1 = k === lyricIdx.length - 1 ? songCut : Math.max(t0 + 1, cut(k));
  s.duration = Math.round((t1 - t0) * 1000) / 1000;
  s.lines = s.lines.map((l, j) => ({
    text: l.text,
    words: perScene[k][j]?.words.map((w) => ({ w: w.w, start: +(w.start - t0).toFixed(3), end: +(w.end - t0).toFixed(3) })),
  }));
});

// movement songs: kids jump/clap exactly on the song's beat
const beat = (aligned as { beat?: number | null }).beat;
if (beat && beat > 0.25 && beat < 1.2) {
  for (const sc of v.scenes) if (sc.type === "lyric" || sc.type === "action") sc.beat = beat;
  log(`beat: ${beat.toFixed(3)}s (${Math.round(60 / beat)} bpm) applied to movement scenes`);
}

const songStart = v.scenes.slice(0, lyricIdx[0]).reduce((t, s) => t + s.duration, 0);
// The song only covers the song part. Everything after it (learning cards + narration) plays
// over `bgm` — ideally the instrumental of the same Suno song, looped.
const instrumental = path.join(assetDir(slug), "instrumental.mp3");
const bgm = fs.existsSync(instrumental) ? rel(instrumental) : v.audio.bgm;
v.audio = { ...v.audio, song: rel(song), songStart, bgm, songEnd: songCut < songLen ? +songCut.toFixed(3) : undefined };
save(slug, v);

const total = v.scenes.reduce((t, s) => t + s.duration, 0);
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`;
log(`timing method: ${method} · singing ends at ${lastWordEnd.toFixed(1)}s of ${songLen.toFixed(1)}s`);
if (songCut < songLen) log(`song trimmed to ${songCut.toFixed(1)}s (instrumental tail removed, fades out) — set SONG_TAIL=<s> to keep more`);
log(`timeline: 0:00 intro · ${mmss(songStart)}–${mmss(songStart + songCut)} SONG · ${mmss(songStart + songCut)}–${mmss(total)} learning part over bgm (${bgm ?? "NONE"})`);
if (!bgm) log(`⚠ no background music for the learning part — save the song's instrumental as public/${slug}/instrumental.mp3 and run again`);
else if (bgm.startsWith("demo/")) log(`⚠ learning part still uses the demo placeholder music — add public/${slug}/instrumental.mp3`);
log(`next: preview  npm run studio  ·  render  npx tsx scripts/05-render.ts ${slug}`);
