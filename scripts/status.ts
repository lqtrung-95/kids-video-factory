/**
 * Where is every video? One line per content/<slug>.json with what is done and the next command.
 *   npm run status
 */
import fs from "node:fs";
import path from "node:path";
import { sceneStarts } from "../src/schema";
import { arrange } from "../src/arrange";
import { PUBLIC, ROOT, load } from "./lib";

const slugs = fs
  .readdirSync(path.join(ROOT, "content"))
  .filter((f) => f.endsWith(".json") && !/\.(align|align-vocals|example)\.json$/.test(f) && !f.includes(".example."))
  .map((f) => f.replace(/\.json$/, ""))
  .sort();

const KIND: Record<string, string> = { vocab: "vocab", country: "countries", count: "counting", color: "colors", letter: "abc", action: "action" };
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`;
const has = (p: string) => fs.existsSync(p);

type Row = { slug: string; title: string; style: string; song: boolean; voice: boolean; timed: boolean; video: boolean; length: string; next: string };
const rows: Row[] = [];
for (const slug of slugs) {
  let v;
  try {
    v = load(slug);
  } catch {
    continue;
  }
  const kinds = new Set(v.scenes.map((s) => KIND[s.type]).filter(Boolean));
  const song = has(path.join(PUBLIC, slug, "song.mp3"));
  const voice = v.scenes.some((s) => s.voice);
  const timed = !!v.audio.song;
  const video = has(path.join(ROOT, "out", slug, `${slug}.mp4`));
  const next = !song
    ? `make the song on Mureka → public/${slug}/song.mp3`
    : !timed
      ? `npm run make -- ${slug} --from=3`
      : !video
        ? `npm run make -- ${slug} --from=5`
        : "ready to upload (review first)";
  rows.push({
    slug,
    title: v.meta.title.split("|")[0].trim(),
    style: [...kinds].join("+") || "-",
    song,
    voice,
    timed,
    video,
    length: (timed ? "" : "~") + mmss(sceneStarts(arrange(v).scenes).total),
    next,
  });
}

const ok = (b: boolean) => (b ? "✓" : "·");
const w = Math.max(...rows.map((r) => r.slug.length));
console.log(`${"slug".padEnd(w)}  song voice timed video  length  next step`);
for (const r of rows) {
  console.log(`${r.slug.padEnd(w)}   ${ok(r.song)}     ${ok(r.voice)}     ${ok(r.timed)}     ${ok(r.video)}   ${r.length.padStart(5)}  ${r.next}`);
}
const done = rows.filter((r) => r.video).length;
console.log(`\n${rows.length} videos · ${rows.filter((r) => r.song).length} with a song · ${done} rendered`);
