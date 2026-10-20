/**
 * Loudness: make the song, the narration and the background music equally loud before rendering,
 * then master the finished video to YouTube's level.
 *
 * Why: Mureka/Suno songs come mastered loud (≈ −13 LUFS) while TTS narration is ≈ −20 LUFS, so the
 * learning part sounded ~9 dB quieter than the song. YouTube turns every video to ≈ −14 LUFS,
 * which made the learning part even quieter on phones and TVs.
 *
 *  - normalizeProps(): writes level-matched copies to public/.norm/ (cached) and points the props at them
 *  - master():         two-pass EBU R128 loudnorm of the final MP4 to −14 LUFS / −1.5 dBTP (video copied)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import type { VideoProps } from "../src/schema";
import { PUBLIC, log } from "./lib";

const TARGET = { song: -16, voice: -16, bgm: -16 } as const;
const NORM_DIR = path.join(PUBLIC, ".norm");

const parseLufs = (txt: string) => {
  const m = [...txt.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop();
  const v = m ? Number(m[1]) : NaN;
  return Number.isFinite(v) && v > -60 ? v : null;
};

/** Integrated loudness (LUFS) of a file, or null when it is too short/silent to measure. */
export const measure = (file: string): number | null => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8" });
  return parseLufs(r.stderr ?? "");
};

/** Level-matched copy of public/<rel> → public/.norm/<rel> (re-made when the source changes). */
const normalized = (rel: string, target: number): string => {
  const src = path.join(PUBLIC, rel);
  if (!fs.existsSync(src)) return rel;
  const out = path.join(NORM_DIR, rel.replace(/\.[^.]+$/, `.${-target}.mp3`));
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs > fs.statSync(src).mtimeMs) return path.relative(PUBLIC, out).split(path.sep).join("/");
  const now = measure(src);
  if (now === null) return rel; // too short / silent to measure — keep as is
  const gain = Math.max(-20, Math.min(15, target - now));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-i", src,
    // gain to the target, then a gentle limiter so boosted peaks never clip
    "-af", `volume=${gain.toFixed(2)}dB,alimiter=limit=0.89:level=false`,
    "-ar", "48000", "-b:a", "192k", out,
  ]);
  return path.relative(PUBLIC, out).split(path.sep).join("/");
};

export const normalizeProps = (v: VideoProps): VideoProps => {
  const a = v.audio;
  const before = { song: a.song ? measure(path.join(PUBLIC, a.song)) : null };
  const audio = {
    ...a,
    song: a.song ? normalized(a.song, TARGET.song) : a.song,
    bgm: a.bgm ? normalized(a.bgm, TARGET.bgm) : a.bgm,
  };
  const scenes = v.scenes.map((s) => (s.voice ? { ...s, voice: normalized(s.voice, TARGET.voice) } : s));
  const voices = scenes.filter((s) => s.voice).length;
  log(`audio levels matched: song ${before.song?.toFixed(1) ?? "?"} → ${TARGET.song} LUFS, ${voices} narration clip(s) → ${TARGET.voice} LUFS, music bed → ${TARGET.bgm} LUFS`);
  return { ...v, audio, scenes };
};

/** Two-pass loudnorm of the finished video (linear gain when possible), video stream copied. */
export const master = (file: string, target = -14) => {
  const filter = `loudnorm=I=${target}:TP=-1.5:LRA=11`;
  const p1 = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", `${filter}:print_format=json`, "-f", "null", "-"], { encoding: "utf8" });
  const json = (p1.stderr ?? "").match(/\{[\s\S]*?"input_i"[\s\S]*?\}/)?.[0];
  if (!json) {
    log("⚠ loudness mastering skipped (could not measure)");
    return;
  }
  const m = JSON.parse(json) as Record<string, string>;
  const tmp = file.replace(/\.mp4$/, ".mastering.mp4");
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-i", file,
    "-af", `${filter}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", tmp,
  ]);
  fs.renameSync(tmp, file);
  log(`mastered: ${Number(m.input_i).toFixed(1)} → ${target} LUFS (YouTube level)`);
};
