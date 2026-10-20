/**
 * Step 5 — render MP4 + thumbnail + YouTube chapters.
 *   npx tsx scripts/05-render.ts <slug> [--scale=1] [--preview]
 * --preview renders at 50% for a quick check.
 */
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { FPS, sceneStarts } from "../src/schema";
import { ROOT, load, log } from "./lib";

const slug = process.argv[2];
if (!slug) throw new Error("Usage: tsx scripts/05-render.ts <slug> [--scale=1] [--preview]");
const preview = process.argv.includes("--preview");
const scale = preview ? 0.5 : Number(process.argv.find((a) => a.startsWith("--scale="))?.split("=")[1] ?? 1);

const mmss = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

(async () => {
  const v = load(slug);
  const outDir = path.join(ROOT, "out", slug);
  fs.mkdirSync(outDir, { recursive: true });

  // chapters: Intro / Song / learning part (YouTube needs the first at 00:00)
  const { starts } = sceneStarts(v.scenes);
  const chapters: string[] = ["00:00 Intro"];
  const firstLyric = v.scenes.findIndex((s) => s.type === "lyric");
  const firstLearn = v.scenes.findIndex((s) => s.type === "title" || s.type === "country" || s.type === "vocab");
  if (firstLyric > 0) chapters.push(`${mmss(starts[firstLyric])} ${v.meta.title.split("|")[0].trim()} Song`);
  if (firstLearn > 0) chapters.push(`${mmss(starts[firstLearn])} ${v.meta.title.split("|")[1]?.trim() ?? "Let's learn"}`);
  const description = v.meta.description.replace(/\n?(\d\d:\d\d .*\n?)+/g, "\n").trim() + "\n\n⏱️ Timestamps ⏱️\n" + chapters.join("\n");
  fs.writeFileSync(path.join(outDir, "youtube.json"), JSON.stringify({ ...v.meta, description }, null, 2));

  log("bundling…");
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts") });
  const browserExecutable = process.env.REMOTION_BROWSER ?? null;
  const composition = await selectComposition({ serveUrl, id: "KidsVideo", inputProps: v, browserExecutable });

  // thumbnail: middle of the first learning card (bright, characters + big text)
  const thumbScene = firstLearn > 0 ? firstLearn + (v.scenes[firstLearn].type === "title" ? 1 : 0) : 0;
  const thumbFrame = Math.round((starts[thumbScene] + v.scenes[thumbScene].duration * 0.6) * FPS);
  await renderStill({ composition, serveUrl, inputProps: v, frame: thumbFrame, output: path.join(outDir, "thumbnail.jpg"), imageFormat: "jpeg", jpegQuality: 92, scale: 1280 / 1920, browserExecutable });
  log("thumbnail.jpg ✓");

  const out = path.join(outDir, `${slug}${preview ? "-preview" : ""}.mp4`);
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    inputProps: v,
    outputLocation: out,
    scale,
    crf: preview ? 28 : 18,
    timeoutInMilliseconds: 120000,
    browserExecutable,
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 20);
      if (p !== last) process.stdout.write(`${p * 5}% `), (last = p);
    },
  });
  console.log();
  log(`video → ${path.relative(ROOT, out)}`);
  log(`next: npx tsx scripts/06-upload.ts ${slug}`);
})();
