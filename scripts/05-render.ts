/**
 * Step 5 — render MP4 + thumbnail + YouTube chapters.
 *   npx tsx scripts/05-render.ts <slug> [--scale=1] [--preview]
 * --preview renders at 50% for a quick check.
 */
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { arrange, chapters } from "../src/arrange";
import { master, normalizeProps } from "./audio";
import { ROOT, load, log } from "./lib";

const slug = process.argv[2];
if (!slug) throw new Error("Usage: tsx scripts/05-render.ts <slug> [--scale=1] [--preview]");
const preview = process.argv.includes("--preview");
const scale = preview ? 0.5 : Number(process.argv.find((a) => a.startsWith("--scale="))?.split("=")[1] ?? 1);

(async () => {
  const v = load(slug);
  const outDir = path.join(ROOT, "out", slug);
  fs.mkdirSync(outDir, { recursive: true });

  // chapters: one per learning group, on the final timeline (chorus breaks + sing-again included)
  const description =
    v.meta.description.replace(/\n*⏱️ Timestamps ⏱️[\s\S]*$/, "").replace(/\n?(\d\d:\d\d .*\n?)+/g, "\n").trim() +
    "\n\n⏱️ Timestamps ⏱️\n" +
    chapters(arrange(v)).join("\n");
  fs.writeFileSync(path.join(outDir, "youtube.json"), JSON.stringify({ ...v.meta, description }, null, 2));

  // song, narration and music bed at the same loudness (copies in public/.norm/)
  const props = normalizeProps(v);

  log("bundling…");
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts") });
  const browserExecutable = process.env.REMOTION_BROWSER ?? null;
  const composition = await selectComposition({ serveUrl, id: "KidsVideo", inputProps: props, browserExecutable });

  // thumbnail: its own layout (big title, subjects, kids) — src/Thumbnail.tsx
  const thumb = await selectComposition({ serveUrl, id: "Thumbnail", inputProps: v, browserExecutable });
  await renderStill({ composition: thumb, serveUrl, inputProps: v, frame: 0, output: path.join(outDir, "thumbnail.jpg"), imageFormat: "jpeg", jpegQuality: 92, browserExecutable });
  log("thumbnail.jpg ✓");

  const out = path.join(outDir, `${slug}${preview ? "-preview" : ""}.mp4`);
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    inputProps: props,
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
  master(out); // whole video to YouTube's loudness (−14 LUFS)
  log(`video → ${path.relative(ROOT, out)}`);
  log(`next: npx tsx scripts/06-upload.ts ${slug}`);
})();
