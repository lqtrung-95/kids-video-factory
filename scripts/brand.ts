/**
 * Your own intro / outro clips (optional).
 *
 * Put the channel's clips in public/brand/ and every video uses them automatically:
 *   public/brand/intro.mp4   → replaces the built-in "Meo with Pi" intro card
 *   public/brand/outro.mp4   → replaces the built-in "Spread the love" + "Subscribe" cards
 * (.mov / .webm / .m4v work too). No files → the built-in cards are used, nothing changes.
 *
 * Per video, in content/<slug>.json:
 *   "brand": { "intro": "brand/intro-halloween.mp4" }   another clip for this video
 *   "brand": { "outro": false }                           built-in outro for this video
 *   "brand": { "outroReplaces": "subscribe" }             keep "Spread the love", replace only Subscribe
 *
 * The clip's sound is level-matched like the rest (public/.norm/brand/…, video stream copied).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { Scene, VideoProps } from "../src/schema";
import { measure } from "./audio";
import { PUBLIC, log } from "./lib";

const EXT = [".mp4", ".mov", ".webm", ".m4v"];
const TARGET = -16;

const findDefault = (name: "intro" | "outro") => {
  for (const e of EXT) if (fs.existsSync(path.join(PUBLIC, "brand", name + e))) return `brand/${name}${e}`;
  return undefined;
};

const probe = (file: string) => {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name", "-of", "json", file]).toString();
  const j = JSON.parse(out) as { format: { duration: string }; streams: { codec_type: string; codec_name: string }[] };
  const video = j.streams.find((s) => s.codec_type === "video")?.codec_name ?? "";
  return { duration: Number(j.format.duration), audio: j.streams.some((s) => s.codec_type === "audio"), h264: video === "h264" || video === "hevc" };
};

/** Copy of the clip with its sound at the same loudness as the songs (cached). */
const levelled = (rel: string, hasAudio: boolean, h264: boolean): string => {
  if (!hasAudio) return rel;
  const src = path.join(PUBLIC, rel);
  const out = path.join(PUBLIC, ".norm", rel.replace(/\.[^.]+$/, `.${-TARGET}.mp4`));
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs > fs.statSync(src).mtimeMs) return path.relative(PUBLIC, out).split(path.sep).join("/");
  const now = measure(src);
  if (now === null) return rel;
  const gain = Math.max(-20, Math.min(15, TARGET - now));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-i", src,
    "-map", "0:v:0", "-map", "0:a:0",
    ...(h264 ? ["-c:v", "copy"] : ["-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p"]),
    "-af", `volume=${gain.toFixed(2)}dB,alimiter=limit=0.89:level=false`,
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", out,
  ]);
  return path.relative(PUBLIC, out).split(path.sep).join("/");
};

const clip = (rel: string, role: "intro" | "outro", level: boolean): Scene | undefined => {
  const file = path.join(PUBLIC, rel);
  if (!fs.existsSync(file)) {
    log(`⚠ brand ${role} not found: public/${rel} — using the built-in ${role}`);
    return undefined;
  }
  const { duration, audio, h264 } = probe(file);
  return { id: `brand:${role}`, type: "clip", role, src: level ? levelled(rel, audio, h264) : rel, duration: +duration.toFixed(3), volume: 1, voiceOffset: 0, transition: "auto", fx: "none" } as Scene;
};

/** Swap the built-in intro/outro cards for your clips (when there are any). quiet = timeline only (no logs, no audio copies). */
export const withBrand = (v: VideoProps, quiet = false): VideoProps => {
  if (v.scenes.some((s) => s.id?.startsWith("brand:"))) return v;
  const b = v.brand ?? { outroReplaces: "both" as const };
  const introRel = b.intro === false ? undefined : (b.intro ?? findDefault("intro"));
  const outroRel = b.outro === false ? undefined : (b.outro ?? findDefault("outro"));
  if (!introRel && !outroRel) return v;

  let scenes = [...v.scenes];
  const intro = introRel ? clip(introRel, "intro", !quiet) : undefined;
  if (intro) {
    const i = scenes.findIndex((s) => s.type === "intro");
    if (i >= 0) scenes[i] = intro;
    else scenes = [intro, ...scenes];
  }
  const outro = outroRel ? clip(outroRel, "outro", !quiet) : undefined;
  if (outro) {
    const drop = b.outroReplaces === "none" ? [] : b.outroReplaces === "subscribe" ? ["subscribe"] : ["outro", "subscribe"];
    scenes = scenes.filter((s) => !drop.includes(s.type));
    scenes.push(outro);
  }
  if (!quiet) {
    log(
      `brand clips: ${intro ? `intro ${intro.duration.toFixed(1)}s (${introRel})` : "built-in intro"} · ` +
        `${outro ? `outro ${outro.duration.toFixed(1)}s (${outroRel})` : "built-in outro"}`,
    );
  }
  // the song part starts later/earlier when the intro length changed
  const firstLyric = scenes.findIndex((s) => s.type === "lyric");
  const songStart = intro && firstLyric >= 0 ? +scenes.slice(0, firstLyric).reduce((t, s) => t + s.duration, 0).toFixed(3) : v.audio.songStart;
  return { ...v, scenes, audio: { ...v.audio, songStart } };
};
