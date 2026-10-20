/**
 * Step 3 — narration for every scene that has `say`.
 *   npx tsx scripts/03-voice.ts <slug> [--force]
 *
 * TTS_PROVIDER (in .env):
 *   edge        free, no key, needs internet   (default)   pip install edge-tts
 *   kokoro      free, open-source, offline                 pip install kokoro soundfile
 *   elevenlabs  paid, most natural                         ELEVENLABS_API_KEY
 *   none        skip narration (cards just show the text)
 * Scene duration is stretched so the narration always fits.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, assetDir, audioSeconds, env, load, log, rel, save } from "./lib";

const slug = process.argv[2];
if (!slug) throw new Error("Usage: tsx scripts/03-voice.ts <slug> [--force]");
const force = process.argv.includes("--force");
const provider = (process.env.TTS_PROVIDER ?? "edge") as "edge" | "kokoro" | "elevenlabs" | "none";

const DEFAULT_VOICE: Record<string, string> = {
  edge: "en-US-AnaNeural", // a child's voice; also nice: en-US-JennyNeural, en-GB-MaisieNeural
  kokoro: "af_heart",
  elevenlabs: "21m00Tcm4TlvDq8ikWAM",
};
const voice = process.env.TTS_VOICE ?? process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE[provider];

async function elevenlabs(text: string): Promise<Buffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": env("ELEVENLABS_API_KEY"), "content-type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL ?? "eleven_multilingual_v2",
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.45, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function tts(text: string, out: string) {
  if (provider === "elevenlabs") return fs.writeFileSync(out, await elevenlabs(text));
  execFileSync(process.env.PYTHON ?? "python3", [path.join(ROOT, "scripts", "tts.py"), provider, voice, text, out], {
    stdio: ["ignore", "inherit", "inherit"],
  });
}

(async () => {
  const v = load(slug);
  if (provider === "none") {
    v.scenes.forEach((s) => delete s.voice);
    save(slug, v);
    log("TTS_PROVIDER=none — narration skipped.");
    return;
  }
  const dir = assetDir(slug);
  log(`narration with ${provider} (${voice})`);
  for (const [i, s] of v.scenes.entries()) {
    if (!s.say) continue;
    const out = path.join(dir, `voice-${String(i).padStart(2, "0")}.mp3`);
    if (force || !fs.existsSync(out)) await tts(s.say, out);
    s.voice = rel(out);
    const len = audioSeconds(out);
    if (s.type === "action" && s.action === "freeze" && /freeze/i.test(s.say)) s.freezeAt = +(s.voiceOffset + len - 0.45).toFixed(2);
    const need = s.voiceOffset + len + (s.type === "action" && s.action === "freeze" ? 2.2 : 0.9);
    if (s.type !== "lyric" && s.duration < need) s.duration = Math.round(need * 10) / 10;
    log(`${rel(out)}  "${s.say}"  → scene ${i} ${s.duration}s`);
  }
  save(slug, v);
  log(`next: make the song →  npx tsx scripts/04-song.ts ${slug}`);
})();
