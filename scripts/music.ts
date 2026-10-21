/**
 * Music styles for the songs. Every video gets one (meta.musicStyle), chosen so the channel
 * rotates through them — a channel where every song sounds the same is boring for kids and looks
 * mass-produced to YouTube ("inauthentic content").
 *
 * Paste the style text into Mureka's "Style" box (04-song writes it to content/<slug>.mureka-style.txt).
 */
import fs from "node:fs";
import path from "node:path";
import type { VideoProps } from "../src/schema";
import { ROOT } from "./lib";

export const MUSIC_STYLES: Record<string, string> = {
  "ukulele-pop": "happy children's song, nursery rhyme, ukulele, glockenspiel, claps, cheerful female vocal with kids choir, 110 bpm, clear diction, simple melody",
  "bright-pop": "upbeat kids pop, bright synths, handclaps, energetic female vocal with kids choir, 118 bpm, clear diction, catchy chorus",
  reggae: "children's reggae, offbeat guitar, warm bass, shakers, friendly male vocal with kids choir, 95 bpm, clear diction, sunny and simple",
  country: "kids country song, acoustic guitar, banjo, fiddle, foot stomps, friendly male vocal, 105 bpm, clear diction, simple melody",
  marching: "playful marching band for kids, brass, snare drum, xylophone, cheerful children's choir, 112 bpm, clear diction, simple melody",
  "kid-voice": "sweet children's song sung by a young child, piano, glockenspiel, soft drums, 100 bpm, clear diction, simple melody",
  // used automatically for these kinds of videos
  dance: "happy children's dance song, upbeat, ukulele, glockenspiel, claps, drums, cheerful female vocal with kids choir, 120 bpm, clear diction, simple melody",
  lullaby: "gentle lullaby, children's bedtime song, soft piano, music box, warm female vocal, 80 bpm, clear diction, simple melody",
};
const ROTATION = ["ukulele-pop", "bright-pop", "reggae", "country", "marching", "kid-voice"];

/** The style for this video: kept if already chosen, otherwise the least-used one in the rotation. */
export const pickStyle = (v: VideoProps, slug: string): string => {
  if (v.meta.musicStyle && MUSIC_STYLES[v.meta.musicStyle]) return v.meta.musicStyle;
  const text = `${v.meta.title} ${v.meta.tags.join(" ")}`.toLowerCase();
  if (/lullaby|bedtime|good night|sleep/.test(text)) return "lullaby";
  if (v.scenes.some((s) => s.type === "action" || (s.type === "lyric" && s.action))) return "dance";
  const used: Record<string, number> = Object.fromEntries(ROTATION.map((r) => [r, 0]));
  const dir = path.join(ROOT, "content");
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json") || f.startsWith(`${slug}.`)) continue;
    try {
      const s = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))?.meta?.musicStyle;
      if (s in used) used[s]++;
    } catch {
      /* not a video file */
    }
  }
  return ROTATION.reduce((best, r) => (used[r] < used[best] ? r : best), ROTATION[0]);
};

/** Lyrics for Mureka with [Verse]/[Chorus] tags (chorus = lyric scenes drawn as a box). */
export const murekaLyrics = (v: VideoProps): string => {
  const out: string[] = [];
  let verse = 0;
  for (const s of v.scenes) {
    if (s.type !== "lyric" || s.id?.startsWith("auto:")) continue;
    out.push(s.textStyle === "box" ? "[Chorus]" : `[Verse ${++verse}]`, ...s.lines.map((l) => l.text), "");
  }
  return out.join("\n").trim() + "\n";
};
