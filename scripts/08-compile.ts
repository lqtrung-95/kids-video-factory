/**
 * Step 8 (optional) — join finished videos into one long compilation with YouTube chapters.
 *   npx tsx scripts/08-compile.ts <name> <slug> <slug> ... [--repeat=2]
 *   npx tsx scripts/08-compile.ts best-of-october animal-sounds-around-the-world counting-fruits colors
 *
 * - keeps the channel intro only on the first video and the subscribe card only on the last
 * - --repeat=N plays the whole list N times (long compilations are where kids' watch time is)
 * Output: out/compilations/<name>.mp4 + <name>.youtube.json (title, description with chapters, tags)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { arrange } from "../src/arrange";
import { withBrand } from "./brand";
import { sceneStarts } from "../src/schema";
import { ROOT, audioSeconds, load, log } from "./lib";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const [name, ...slugs] = args;
if (!name || !slugs.length) throw new Error("Usage: tsx scripts/08-compile.ts <name> <slug> <slug> ... [--repeat=2]");
const repeat = Number(process.argv.find((a) => a.startsWith("--repeat="))?.split("=")[1] ?? 1);

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
  const v = arrange(withBrand(load(slug), true)); // same timeline as the rendered video (chorus breaks, sing-again)
  v.meta.tags.forEach((t) => tags.add(t));
  const { starts, total } = sceneStarts(v.scenes);
  const introIdx = v.scenes.findIndex((s) => s.type === "intro" || (s.type === "clip" && s.role === "intro"));
  const subIdx = v.scenes.findIndex((s) => s.type === "subscribe" || (s.type === "clip" && s.role === "outro"));
  const from = k > 0 && introIdx === 0 ? v.scenes[0].duration : 0;
  const to = k < list.length - 1 && subIdx >= 0 ? starts[subIdx] : Math.min(total, audioSeconds(src));
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

const listFile = path.join(tmp, "list.txt");
fs.writeFileSync(listFile, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
const out = path.join(outDir, `${name}.mp4`);
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", "-movflags", "+faststart", out]);
fs.rmSync(tmp, { recursive: true, force: true });

const minutes = Math.round(clock / 60);
const first = load(slugs[0]);
fs.writeFileSync(
  path.join(outDir, `${name}.youtube.json`),
  JSON.stringify(
    {
      title: `${slugs.length > 1 ? "Kids Songs Compilation" : first.meta.title.split("|")[0].trim()} | ${minutes} Minutes | ${first.meta.channel}`.slice(0, 100),
      description: `${minutes} minutes of sing-along songs for kids!\n\n⏱️ Chapters ⏱️\n${chapters.join("\n")}`,
      tags: [...tags].slice(0, 30),
      madeForKids: true,
    },
    null,
    2,
  ),
);
log(`✓ ${path.relative(ROOT, out)} — ${mmss(clock)} long, ${chapters.length} chapters (see ${name}.youtube.json)`);
