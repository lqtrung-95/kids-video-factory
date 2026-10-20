import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { videoSchema, type VideoProps } from "../src/schema";

export const ROOT = path.resolve(__dirname, "..");
try {
  process.loadEnvFile(path.join(ROOT, ".env"));
} catch {
  /* no .env yet */
}
export const PUBLIC = path.join(ROOT, "public");

export const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

export const contentPath = (slug: string) => path.join(ROOT, "content", `${slug}.json`);
export const assetDir = (slug: string) => {
  const d = path.join(PUBLIC, slug);
  fs.mkdirSync(d, { recursive: true });
  return d;
};
/** path stored in JSON is relative to /public */
export const rel = (abs: string) => path.relative(PUBLIC, abs).split(path.sep).join("/");

export const load = (slug: string): VideoProps => videoSchema.parse(JSON.parse(fs.readFileSync(contentPath(slug), "utf8")));
export const save = (slug: string, v: unknown) => {
  const parsed = videoSchema.parse(v); // never write an invalid file
  fs.writeFileSync(contentPath(slug), JSON.stringify(parsed, null, 2) + "\n");
  return parsed;
};

export const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name} — copy .env.example to .env and fill it in`);
  return v;
};

export const audioSeconds = (file: string) =>
  Number(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim(),
  );

export const log = (...a: unknown[]) => console.log("›", ...a);
