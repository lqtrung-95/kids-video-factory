/**
 * Step 9 (optional) — narration in other languages, as extra audio tracks for the SAME video.
 *   npx tsx scripts/09-dub.ts <slug> --lang=vi,es
 *
 * For every narrated scene: translate `say` (Groq/Claude, see .env), keeping the English words the
 * video teaches ("DOG", "Woof!", "Monday"…), record it with a native voice (edge-tts), and mix a
 * full soundtrack on the video's exact timeline (song, music, sing-again… unchanged, only the
 * narration changes) → out/<slug>/<slug>.<lang>.m4a
 *
 * Upload: YouTube Studio → Languages → Add language → Add audio (multi-language audio, where your
 * channel has it). Viewers then pick the language in the player's settings.
 * Translations are saved in the JSON (scene.dub.<lang>) — fix any of them by hand and run again.
 * Render the video (05) first, so the timeline matches.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { master, measure, normalizeProps } from "./audio";
import { withBrand } from "./brand";
import { askJSON } from "./llm";
import { ROOT, assetDir, audioSeconds, load, log, rel, save } from "./lib";

const slug = process.argv[2];
const langs = (process.argv.find((a) => a.startsWith("--lang="))?.split("=")[1] ?? "vi").split(",").filter(Boolean);
if (!slug) throw new Error("Usage: tsx scripts/09-dub.ts <slug> --lang=vi,es");

/** edge-tts voices (free). Kids' channels usually do best with a warm female voice. */
const VOICES: Record<string, { name: string; voice: string }> = {
  vi: { name: "Vietnamese", voice: "vi-VN-HoaiMyNeural" },
  es: { name: "Spanish (Latin America)", voice: "es-MX-DaliaNeural" },
  pt: { name: "Portuguese (Brazil)", voice: "pt-BR-FranciscaNeural" },
  id: { name: "Indonesian", voice: "id-ID-GadisNeural" },
  hi: { name: "Hindi", voice: "hi-IN-SwaraNeural" },
  fr: { name: "French", voice: "fr-FR-DeniseNeural" },
  de: { name: "German", voice: "de-DE-KatjaNeural" },
  th: { name: "Thai", voice: "th-TH-PremwadeeNeural" },
  ja: { name: "Japanese", voice: "ja-JP-NanamiNeural" },
  ko: { name: "Korean", voice: "ko-KR-SunHiNeural" },
};

const tts = (voice: string, text: string, out: string) =>
  execFileSync(process.env.PYTHON ?? "python3", [path.join(ROOT, "scripts", "tts.py"), "edge", voice, text, out], { stdio: ["ignore", "inherit", "inherit"] });

/** Speed a clip up (max 1.3×) so it ends before the scene does — the video timeline can't move. */
const fit = (file: string, room: number) => {
  const len = audioSeconds(file);
  if (len <= room) return;
  const tempo = Math.min(1.3, len / Math.max(0.5, room));
  const tmp = file.replace(/\.mp3$/, ".fit.mp3");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-af", `atempo=${tempo.toFixed(3)}`, tmp]);
  fs.renameSync(tmp, file);
  if (tempo >= 1.3 && len / 1.3 > room) log(`  ⚠ ${path.basename(file)} is still ${(len / 1.3 - room).toFixed(1)}s too long — shorten scene.dub in the JSON`);
};

(async () => {
  const v = load(slug);
  const video = path.join(ROOT, "out", slug, `${slug}.mp4`);
  if (!fs.existsSync(video)) log(`⚠ render the video first (npm run make -- ${slug} --from=5) — the tracks are made for that timeline`);
  const said = v.scenes.flatMap((s, i) => (s.say ? [{ i, type: s.type, say: s.say, word: (s as { word?: string }).word }] : []));
  if (!said.length) throw new Error("No narration (scene.say) in this video");

  // 1) translate whatever is missing
  for (const lang of langs) {
    const L = VOICES[lang];
    if (!L) throw new Error(`--lang=${lang}: supported ${Object.keys(VOICES).join(", ")}`);
    const todo = said.filter((x) => !v.scenes[x.i].dub?.[lang]);
    if (!todo.length) continue;
    log(`translating ${todo.length} line(s) → ${L.name}…`);
    const r = await askJSON<{ lines: string[] }>(
      `You translate the narration of a children's English-learning video (ages 2-6) into ${L.name}.
Rules: short, warm, natural spoken ${L.name} for little kids. KEEP IN ENGLISH every English word or sound the video teaches
(the card word like DOG / Monday / RED, animal and vehicle sounds like "Woof!", "Beep beep!", and anything the kids repeat),
and introduce it naturally, e.g. Vietnamese: "Đây là con chó! Tiếng Anh là DOG!".
Never ask viewers to comment, like or click. Keep each line about as long as the original (it must fit the same time).
Answer JSON: {"lines": [ ...one translation per input line, same order... ]}`,
      JSON.stringify(todo.map((x) => ({ card: x.type, word: x.word, english: x.say }))),
    );
    if (r.lines?.length !== todo.length) throw new Error(`translation returned ${r.lines?.length} lines for ${todo.length}`);
    todo.forEach((x, k) => (v.scenes[x.i].dub = { ...(v.scenes[x.i].dub ?? {}), [lang]: r.lines[k].trim() }));
    save(slug, v);
  }

  // 2) record + 3) mix one soundtrack per language on the video's timeline
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts") });
  const browserExecutable = process.env.REMOTION_BROWSER ?? null;
  for (const lang of langs) {
    const { voice } = VOICES[lang];
    const dir = path.join(assetDir(slug), `dub-${lang}`);
    fs.mkdirSync(dir, { recursive: true });
    const dubbed = structuredClone(v);
    for (const x of said) {
      const s = dubbed.scenes[x.i];
      const text = s.dub?.[lang];
      if (!text) continue;
      const out = path.join(dir, `voice-${String(x.i).padStart(2, "0")}.mp3`);
      const stamp = `${out}.txt`;
      if (!fs.existsSync(out) || !fs.existsSync(stamp) || fs.readFileSync(stamp, "utf8") !== `${voice}|${text}`) {
        tts(voice, text, out);
        fs.writeFileSync(stamp, `${voice}|${text}`);
        fit(out, s.duration - s.voiceOffset - 0.25);
      }
      s.voice = rel(out);
      log(`  ${lang} ${String(x.i).padStart(2, "0")}: ${text}`);
    }
    const props = normalizeProps(withBrand(dubbed, true));
    const composition = await selectComposition({ serveUrl, id: "KidsVideo", inputProps: props, browserExecutable });
    const wav = path.join(ROOT, "out", slug, `${slug}.${lang}.wav`);
    fs.mkdirSync(path.dirname(wav), { recursive: true });
    await renderMedia({ composition, serveUrl, codec: "wav", inputProps: props, outputLocation: wav, browserExecutable });
    // same loudness as the video, AAC in .m4a (what YouTube Studio's "Add audio" accepts)
    const tmp = wav.replace(/\.wav$/, ".tmp.mp4");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=black:s=16x16:r=1", "-i", wav, "-shortest", "-c:v", "libx264", "-c:a", "aac", "-b:a", "192k", tmp]);
    master(tmp);
    const m4a = wav.replace(/\.wav$/, ".m4a");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", tmp, "-vn", "-c:a", "copy", m4a]);
    fs.rmSync(tmp);
    fs.rmSync(wav);
    log(`${VOICES[lang].name} track → ${path.relative(ROOT, m4a)} (${measure(m4a)?.toFixed(1)} LUFS)`);
  }
  log("upload: YouTube Studio → Languages → Add language → Add audio → choose the .m4a");
})();
