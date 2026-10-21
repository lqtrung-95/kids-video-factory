/**
 * Step 8 (optional) — join finished videos into one long video with YouTube chapters.
 *
 *   npx tsx scripts/08-compile.ts <name> <slug> <slug> ... [--repeat=2]     pick the videos yourself
 *   npx tsx scripts/08-compile.ts --theme="Animal Songs" [--repeat=2]       every rendered video in that playlist
 *   npx tsx scripts/08-compile.ts --all                                      every rendered video
 *   npx tsx scripts/08-compile.ts --theme="Animal Songs" --hours=3           a long loop for a 24/7 live stream
 *
 * - keeps the channel intro only on the first video and the subscribe card / outro only on the last
 * - --repeat=N plays the whole list N times (long compilations are where kids' watch time is)
 * - --hours=N repeats the list until it is N hours long (no chapters) — stream it with OBS or
 *   YouTube Studio → Go live → "Stream a video file", restarting it every few days
 * Output: out/compilations/<name>.mp4 + <name>.youtube.json (title, description with chapters, tags)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { arrange } from "../src/arrange";
import { sceneStarts } from "../src/schema";
import { withBrand } from "./brand";
import { ROOT, audioSeconds, load, log, slugify } from "./lib";

const opt = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=").replace(/^"|"$/g, "");
const flag = (k: string) => process.argv.includes(`--${k}`);
const theme = opt("theme");
const hours = Number(opt("hours") ?? 0);
const repeat = Number(opt("repeat") ?? 1);

const rendered = (slug: string) => fs.existsSync(path.join(ROOT, "out", slug, `${slug}.mp4`));
const allSlugs = fs
  .readdirSync(path.join(ROOT, "content"))
  .filter((f) => /^[a-z0-9-]+\.json$/.test(f))
  .map((f) => f.replace(/\.json$/, ""));

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
let name = args[0];
let slugs = args.slice(1);
if (theme || flag("all")) {
  slugs = allSlugs.filter((s) => {
    if (!rendered(s)) return false;
    try {
      return flag("all") || load(s).meta.playlists.includes(theme!);
    } catch {
      return false;
    }
  });
  name = args[0] ?? slugify(theme ?? "all-songs") + (hours ? `-${hours}h-loop` : "");
  if (!slugs.length) throw new Error(`No rendered videos ${theme ? `in playlist "${theme}"` : ""} — render some first (npm run status)`);
}
if (!name || !slugs.length) throw new Error('Usage: tsx scripts/08-compile.ts <name> <slug> <slug> ... | --theme="Animal Songs" | --all  [--repeat=2] [--hours=3]');

const outDir = path.join(ROOT, "out", "compilations");
const tmp = path.join(outDir, `.${name}-parts`);
fs.mkdirSync(tmp, { recursive: true });

const list = Array.from({ length: repeat }, () => slugs).flat();
const mmss = (t: number) =>
  t >= 3600
    ? `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`
    : `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

const parts: string[] = [];
const chapters: string[] = [];
const tags = new Set<string>();
let clock = 0;

list.forEach((slug, k) => {
  const src = path.join(ROOT, "out", slug, `${slug}.mp4`);
  if (!fs.existsSync(src)) throw new Error(`Render it first: ${path.relative(ROOT, src)}`);
  const v = arrange(withBrand(load(slug), true)); // same timeline as the rendered video
  v.meta.tags.forEach((t) => tags.add(t));
  const { starts, total } = sceneStarts(v.scenes);
  const introIdx = v.scenes.findIndex((s) => s.type === "intro" || (s.type === "clip" && s.role === "intro"));
  const endIdx = v.scenes.findIndex((s) => s.type === "subscribe" || (s.type === "clip" && s.role === "outro"));
  const last = k === list.length - 1 && !hours; // a loop never "ends"
  const from = k > 0 && introIdx === 0 ? v.scenes[0].duration : 0;
  const to = !last && endIdx >= 0 ? starts[endIdx] : Math.min(total, audioSeconds(src));
  const part = path.join(tmp, `${String(k).padStart(3, "0")}.mp4`);
  // normalise every part (size, fps, audio) so they can be joined without re-encoding again
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-ss", String(from), "-to", String(to), "-i", src,
    "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p",
    "-af", "aresample=48000,aformat=channel_layouts=stereo",
    "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-c:a", "aac", "-b:a", "160k", part,
  ]);
  chapters.push(`${mmss(clock)} ${v.meta.title.split("|")[0].trim()}`);
  clock += audioSeconds(part);
  parts.push(part);
  log(`+ ${slug} (${(to - from).toFixed(0)}s)`);
});

// --hours: play the encoded parts again and again (no re-encoding) until long enough
let playlist = [...parts];
if (hours > 0) {
  const once = clock;
  const times = Math.max(1, Math.ceil((hours * 3600) / once));
  playlist = Array.from({ length: times }, () => parts).flat();
  clock = once * times;
}

const listFile = path.join(tmp, "list.txt");
fs.writeFileSync(listFile, playlist.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
const out = path.join(outDir, `${name}.mp4`);
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", "-movflags", "+faststart", out]);
fs.rmSync(tmp, { recursive: true, force: true });

const minutes = Math.round(clock / 60);
const first = load(slugs[0]);
const label = theme ?? (slugs.length > 1 ? "Kids Songs Compilation" : first.meta.title.split("|")[0].trim());
fs.writeFileSync(
  path.join(outDir, `${name}.youtube.json`),
  JSON.stringify(
    {
      title: (hours ? `${label} 🔴 24/7 Sing-Along | ${first.meta.channel}` : `${label} | ${minutes} Minutes | ${first.meta.channel}`).slice(0, 100),
      description: hours
        ? `Non-stop sing-along songs for kids: ${slugs.map((s) => load(s).meta.title.split("|")[0].trim()).join(", ")}.`
        : `${minutes} minutes of sing-along songs for kids!\n\n⏱️ Chapters ⏱️\n${chapters.join("\n")}`,
      tags: [...tags].slice(0, 30),
      madeForKids: true,
    },
    null,
    2,
  ),
);
log(`✓ ${path.relative(ROOT, out)} — ${mmss(clock)} long${hours ? " (loop)" : `, ${chapters.length} chapters`} (see ${name}.youtube.json)`);
