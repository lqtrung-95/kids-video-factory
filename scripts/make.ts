/**
 * One command for the whole pipeline.
 *   npx tsx scripts/make.ts "Dinosaurs" --style=vocab           # steps 1→4, stops to wait for the Suno song
 *   npx tsx scripts/make.ts dinosaurs --from=4 --upload         # after song.mp3 is in place: align → render → upload
 * Options: --from=N --to=N --items=8 --backgrounds --preview --upload --shorts --force (redo lyric timing)
 * Styles (step 1): vocab | countries | counting | colors | abc | action
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, contentPath, log, slugify } from "./lib";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const flag = (k: string) => process.argv.includes(`--${k}`);
const input = process.argv[2];
if (!input) throw new Error('Usage: tsx scripts/make.ts "<topic or slug>" [--style=vocab|countries] [--from=N] [--upload]');
const slug = fs.existsSync(contentPath(input)) ? input : slugify(input);
const from = Number(arg("from") ?? (fs.existsSync(contentPath(slug)) ? 2 : 1));
const to = Number(arg("to") ?? (flag("upload") ? 6 : 5));

const run = (script: string, ...args: string[]) => {
  log(`── ${script} ${args.join(" ")}`);
  execFileSync("npx", ["tsx", path.join(ROOT, "scripts", script), ...args], { stdio: "inherit", cwd: ROOT });
};

const steps: Record<number, () => void> = {
  1: () => run("01-write-content.ts", input, `--style=${arg("style") ?? "vocab"}`, `--items=${arg("items") ?? 8}`),
  2: () => run("02-images.ts", slug, ...(flag("backgrounds") ? ["--backgrounds"] : [])),
  3: () => run("03-voice.ts", slug),
  4: () => {
    run("04-song.ts", slug, ...(flag("force") ? ["--force"] : [])); // --force: redo the lyric timing
    if (!fs.existsSync(path.join(ROOT, "public", slug, "song.mp3"))) {
      log(`⏸  waiting for public/${slug}/song.mp3 — then: npx tsx scripts/make.ts ${slug} --from=4`);
      process.exit(0);
    }
  },
  5: () => run("05-render.ts", slug, ...(flag("preview") ? ["--preview"] : [])),
  6: () => run("06-upload.ts", slug),
  7: () => run("07-shorts.ts", slug),
};

for (let i = from; i <= to; i++) if (i !== 6 || flag("upload")) steps[i]();
if (flag("shorts") && to < 7) steps[7]();
log("done ✓");
