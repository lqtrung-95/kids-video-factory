/**
 * Step 2 — generate illustrations for scenes that have an `imagePrompt`.
 *   npx tsx scripts/02-images.ts <slug> [--backgrounds] [--force]
 *
 * - vocab scenes      → transparent PNG of the subject (always)
 * - country scenes    → transparent PNG of the kids in costume (when imagePrompt is set)
 * - lyric scenes      → full background illustration (only with --backgrounds; vector backgrounds otherwise)
 *
 * Consistency: put 1-3 reference images of the channel's style/mascot in public/brand/ref-*.png.
 * When present they are sent as references (images/edits), so every picture shares one look.
 */
import fs from "node:fs";
import path from "node:path";
import { PUBLIC, assetDir, env, load, log, rel, save } from "./lib";

const slug = process.argv[2];
if (!slug) throw new Error("Usage: tsx scripts/02-images.ts <slug> [--backgrounds] [--force]");
const withBg = process.argv.includes("--backgrounds");
const force = process.argv.includes("--force");
const MODEL = process.env.IMAGE_MODEL ?? "gpt-image-1-mini";

const STYLE =
  "Flat vector illustration for a preschool YouTube channel: bright saturated colors, thick clean rounded shapes, " +
  "soft shading, cute chibi proportions (big head, closed happy eyes, rosy cheeks), no text, no letters, no watermark.";

const refDir = path.join(PUBLIC, "brand");
const refs = fs.existsSync(refDir) ? fs.readdirSync(refDir).filter((f) => /^ref-.*\.(png|jpe?g|webp)$/i.test(f)) : [];

async function generate(prompt: string, opts: { transparent: boolean; size: string }): Promise<Buffer> {
  const key = env("OPENAI_API_KEY");
  const full = `${prompt}\n\nStyle: ${STYLE}${opts.transparent ? " Single subject, centered, transparent background." : ""}`;
  let res: Response;
  if (refs.length) {
    const form = new FormData();
    form.append("model", MODEL);
    form.append("prompt", `${full}\nMatch the art style of the reference images exactly.`);
    form.append("size", opts.size);
    form.append("quality", "medium");
    if (opts.transparent) form.append("background", "transparent");
    for (const r of refs) {
      form.append("image[]", new Blob([fs.readFileSync(path.join(refDir, r))], { type: "image/png" }), r);
    }
    res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  } else {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt: full,
        size: opts.size,
        quality: "medium",
        ...(opts.transparent ? { background: "transparent" } : {}),
      }),
    });
  }
  if (!res.ok) throw new Error(`Image API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { data: { b64_json: string }[] };
  return Buffer.from(data.data[0].b64_json, "base64");
}

(async () => {
  const v = load(slug);
  if (!process.env.OPENAI_API_KEY) {
    log("no OPENAI_API_KEY — skipping AI images (emoji / vector kids are used instead).");
    return;
  }
  const dir = assetDir(slug);
  let made = 0;
  for (const [i, s] of v.scenes.entries()) {
    if (!s.imagePrompt) continue;
    const out = path.join(dir, `scene-${String(i).padStart(2, "0")}.png`);
    const exists = fs.existsSync(out) && !force;
    if (s.type === "vocab") {
      if (!exists) fs.writeFileSync(out, await generate(s.imagePrompt, { transparent: true, size: "1024x1024" }));
      s.image = rel(out);
    } else if (s.type === "country") {
      if (!exists) fs.writeFileSync(out, await generate(s.imagePrompt, { transparent: true, size: "1024x1536" }));
      s.characters = [{ image: rel(out) }];
    } else if (s.type === "lyric" && withBg) {
      if (!exists) fs.writeFileSync(out, await generate(s.imagePrompt, { transparent: false, size: "1536x1024" }));
      s.background = { ...s.background, kind: "image", src: rel(out) };
    } else continue;
    made++;
    log(`${exists ? "kept" : "made"} ${rel(out)}  (${s.type})`);
  }
  save(slug, v);
  log(`${made} images linked. next: npx tsx scripts/03-voice.ts ${slug}`);
})();
