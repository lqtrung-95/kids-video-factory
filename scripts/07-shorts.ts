/**
 * Step 7 (optional) — cut a finished video into vertical YouTube Shorts (≤ 59 s each).
 *   npx tsx scripts/07-shorts.ts <slug> [--max=6] [--list]
 *
 * One Short per natural block:
 *   - the song part (if it fits in 59 s)
 *   - each learning group: a "vocab" card + the cards that follow it (e.g. one animal in 5 countries),
 *     or runs of count / color / letter / action / country cards packed into ≤ 59 s
 * --list only prints the plan. Output: out/<slug>/shorts/NN-<label>.mp4 + shorts.json (titles, descriptions)
 * Research note: Shorts work best as a way to send viewers back to the long video, so each one
 * ends on the channel name and its description links to the full video.
 */
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { sceneStarts, type Scene } from "../src/schema";
import { ROOT, load, log, slugify } from "./lib";

const slug = process.argv[2];
if (!slug) throw new Error("Usage: tsx scripts/07-shorts.ts <slug> [--max=6] [--list]");
const max = Number(process.argv.find((a) => a.startsWith("--max="))?.split("=")[1] ?? 6);
const listOnly = process.argv.includes("--list");
const LIMIT = 59;

const v = load(slug);
const { starts } = sceneStarts(v.scenes);
const end = (i: number) => starts[i] + v.scenes[i].duration;
const LEARN = new Set(["vocab", "country", "count", "color", "letter", "action"]);

type Block = { from: number; to: number; title: string; label: string };
const blocks: Block[] = [];

// 1) the song
const lyr = v.scenes.flatMap((s, i) => (s.type === "lyric" ? [i] : []));
if (lyr.length) {
  const from = starts[lyr[0]];
  const to = end(lyr[lyr.length - 1]);
  if (to - from <= LIMIT) blocks.push({ from, to, title: `${v.meta.title.split("|")[0].trim()} 🎵`, label: "song" });
}

// 2) learning groups
const titleFor = (s: Scene, group: Scene[]): string => {
  switch (s.type) {
    case "vocab":
      return s.guess ? `Who says ${s.guess.replace(/!+$/, "")}? 🤔` : `${s.word}! ✨`;
    case "count":
      return `Count to ${Math.max(...group.map((g) => (g.type === "count" ? g.number : 0)))} with me! 🔢`;
    case "color":
      return `${group.map((g) => (g.type === "color" ? g.name : "")).filter(Boolean).join(", ")} 🌈`;
    case "letter":
      return `ABC: ${group.map((g) => (g.type === "letter" ? g.letter : "")).join(" ")} 🔤`;
    case "action":
      return "Freeze dance! Can you freeze? 🧊";
    case "country":
      return "How do kids say hello? 🌍";
    default:
      return v.meta.title.split("|")[0].trim();
  }
};

let i = 0;
while (i < v.scenes.length) {
  const s = v.scenes[i];
  if (!LEARN.has(s.type)) {
    i++;
    continue;
  }
  const group: number[] = [i];
  let j = i + 1;
  // a vocab card owns the non-vocab learning cards right after it (animal → its 5 countries)
  while (j < v.scenes.length && LEARN.has(v.scenes[j].type) && v.scenes[j].type !== "vocab" && end(j) - starts[i] <= LIMIT) {
    if (s.type !== "vocab" && v.scenes[j].type !== s.type) break;
    group.push(j++);
  }
  if (s.type === "vocab" && group.length === 1) {
    // single vocab cards: pack several together
    while (j < v.scenes.length && v.scenes[j].type === "vocab" && end(j) - starts[i] <= LIMIT) group.push(j++);
  }
  const scenes = group.map((k) => v.scenes[k]);
  blocks.push({ from: starts[i], to: end(group[group.length - 1]), title: titleFor(s, scenes), label: slugify(titleFor(s, scenes)).slice(0, 30) || s.type });
  i = j;
}

const chosen = blocks.slice(0, max);
log(`${blocks.length} possible Shorts, making ${chosen.length}:`);
chosen.forEach((b, k) => log(`  ${String(k + 1).padStart(2, "0")}  ${b.from.toFixed(1)}–${b.to.toFixed(1)}s (${(b.to - b.from).toFixed(0)}s)  "${b.title}"`));
if (listOnly) process.exit(0);

(async () => {
  const outDir = path.join(ROOT, "out", slug, "shorts");
  fs.mkdirSync(outDir, { recursive: true });
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts") });
  const browserExecutable = process.env.REMOTION_BROWSER ?? null;
  const meta: object[] = [];
  for (const [k, b] of chosen.entries()) {
    const inputProps = { ...v, short: { from: b.from, to: b.to, title: b.title } };
    const composition = await selectComposition({ serveUrl, id: "KidsShort", inputProps, browserExecutable });
    const file = path.join(outDir, `${String(k + 1).padStart(2, "0")}-${b.label}.mp4`);
    await renderMedia({ composition, serveUrl, codec: "h264", inputProps, outputLocation: file, crf: 20, timeoutInMilliseconds: 120000, browserExecutable });
    log(`✓ ${path.relative(ROOT, file)}`);
    meta.push({
      file: path.basename(file),
      title: `${b.title} #shorts`.slice(0, 100),
      description: `${b.title}\nFull video: ${v.meta.title}\n#shorts #kidssongs #learnenglish`,
      tags: v.meta.tags,
    });
  }
  fs.writeFileSync(path.join(outDir, "shorts.json"), JSON.stringify(meta, null, 2));
  log(`done → out/${slug}/shorts/`);
})();
