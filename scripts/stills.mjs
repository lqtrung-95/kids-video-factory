// Render preview stills for quick visual QA:
//   node scripts/stills.mjs content/x.json 90,250,430
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";

const [, , json = "content/hello-around-the-world.json", frames = "90"] = process.argv;
const inputProps = JSON.parse(fs.readFileSync(json, "utf8"));
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browserExecutable = process.env.REMOTION_BROWSER ?? null;
const composition = await selectComposition({ serveUrl, id: "KidsVideo", inputProps, browserExecutable });
fs.mkdirSync("out/stills", { recursive: true });
for (const f of frames.split(",").map(Number)) {
  await renderStill({
    composition,
    serveUrl,
    inputProps,
    frame: f,
    output: `out/stills/f${String(f).padStart(4, "0")}.jpg`,
    scale: 0.5,
    imageFormat: "jpeg",
    browserExecutable,
  });
  process.stdout.write(`${f} `);
}
console.log();
