/**
 * Step 1 — topic → full video JSON (lyrics, scenes, kid looks, image prompts, YouTube meta).
 * LLM: Claude (ANTHROPIC_API_KEY) or Groq (GROQ_API_KEY, free tier) — pick with LLM_PROVIDER.
 *   npx tsx scripts/01-write-content.ts "Dinosaurs"            (vocab-style video)
 *   npx tsx scripts/01-write-content.ts "Hello around the world" --style=countries
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, contentPath, env, log, save, slugify } from "./lib";

const STYLES = ["vocab", "countries", "counting", "colors", "abc", "action"] as const;
type Style = (typeof STYLES)[number];
const topic = process.argv[2];
if (!topic) throw new Error(`Usage: tsx scripts/01-write-content.ts "<topic>" [--style=${STYLES.join("|")}] [--items=8]`);
const style = (process.argv.find((a) => a.startsWith("--style="))?.split("=")[1] ?? "vocab") as Style;
if (!STYLES.includes(style)) throw new Error(`--style must be one of ${STYLES.join(", ")}`);
const items = Number(process.argv.find((a) => a.startsWith("--items="))?.split("=")[1] ?? (style === "counting" ? 10 : 8));
const PROVIDER = (process.env.LLM_PROVIDER ?? (process.env.GROQ_API_KEY && !process.env.ANTHROPIC_API_KEY ? "groq" : "anthropic")) as
  | "anthropic"
  | "groq";
const MODEL =
  PROVIDER === "groq" ? (process.env.GROQ_MODEL ?? "openai/gpt-oss-120b") : (process.env.CLAUDE_MODEL ?? "claude-sonnet-5-5");

const exampleFile: Record<Style, string> = {
  vocab: "hello-around-the-world.json",
  countries: "hello-around-the-world.json",
  counting: "examples/counting.example.json",
  colors: "examples/colors.example.json",
  abc: "examples/abc.example.json",
  action: "examples/action.example.json",
};
const example = fs.readFileSync(path.join(ROOT, "content", exampleFile[style]), "utf8");
const schemaSrc = fs.readFileSync(path.join(ROOT, "src", "schema.ts"), "utf8");

/** What the learning part looks like for each format (see README → "Formats"). */
const LEARNING: Record<Style, string> = {
  vocab: `${items} "vocab" scenes: word = the item name, sub = a short fun fact (max 6 words), emoji = one matching emoji,
   imagePrompt = ONE subject on a plain background, alternate side left/right, pastel bg. For a guessing game add
   guess (e.g. "MOO!") + reveal 3. say e.g. "This is a Triceratops! Triceratops!"`,
  countries: `${items} "country" scenes: alternate layout "poster"/"quad"; flag = ISO-3166 alpha-2 lowercase; native script +
   romanization for non-Latin languages; kid looks wear simple traditional clothes, respectful, no caricature.
   say e.g. "In Japan, we say: Konnichiwa!"`,
  counting: `"count" scenes for 1..${items} (number goes up by one each scene), each with ONE emoji object that fits the
   topic and its plural word. say counts out loud: "One, two, three! Three ducks!"`,
  colors: `${items} "color" scenes: name (e.g. "Red"), hex (a bright, kid-friendly shade), items = 3 emojis that are clearly
   that color. say e.g. "Red! Red like a strawberry!"`,
  abc: `"letter" scenes, one per letter in order (${items} letters, start at A unless the topic says otherwise), word = an
   easy concrete noun starting with that letter, emoji for it. sound = phonics like "/b/" (display only).
   say e.g. "B is for Ball. B, B, ball!" (spell letters by name — TTS cannot say phonemes)`,
  action: `a FREEZE DANCE game: ${items} "action" scenes alternating a movement (jump, clap, spin, wiggle, stomp, wave) and a
   "freeze" scene. Movement say: "Jump, jump, jump!". Freeze say MUST end with "FREEZE!" (e.g. "Dance, dance... FREEZE!").
   ALSO: in the SONG part, give every lyric scene an "action" matching its words (the kids do it on the beat).`,
};

const system = `You write content for "Meo with Pi", a YouTube channel of English songs for kids aged 2-7 (many viewers are Vietnamese children learning English).
You output ONE JSON object that validates against the zod schema provided. No markdown fences, no commentary.

Video structure (always in this order):
1. intro scene (4s).
2. SONG part: 6-10 "lyric" scenes, each 2 short lines (max 7 words per line), simple A1 English, lots of repetition, a catchy chorus that returns at least twice. Lyrics MUST be 100% original — never reuse or paraphrase lines from existing songs (no "Baby Shark", "Wheels on the Bus", etc.).
   Vary background.kind (sky, meadow, sea, desert, globe, blocks) and textPosition (bottom/left/top); use textStyle "box" for 1-2 chorus scenes.
   Each lyric scene has 1-4 characters with a "look" (vector kids) and may add 1-3 "emojis". Show diverse kids respectfully.
3. a "title" scene introducing the learning part (with a "say").
4. LEARNING part: ${LEARNING[style]}
   Each learning scene: duration 5 (narration step stretches it if needed).
5. a "title" scene "Your turn!" (duration 6) that asks the kids to DO something out loud right now — make the sound,
   do the move, say the words, point at something ("Your turn! Can you roar like a lion? Ready? Roar! Great job!").
   The video is "Made for Kids": YouTube turns OFF comments, end screens and notifications, so NEVER ask viewers to
   comment, like, subscribe in words, or click anything.
6. outro scene (a topic-fitting phrase) and a subscribe scene.

Durations of lyric scenes are placeholders (5-6s); the alignment step recomputes them from the real song.
For lyric scenes also write an "imagePrompt" describing a background illustration for that line (no text, no close-up faces) — it is optional to use.
meta.title ≤ 90 chars in the channel's style "X | Y | Song for Kids"; meta.description: 1 short paragraph + one line "👨‍👩‍👧 Tip for parents: …" (an activity to do together — never ask for comments); 10-15 tags mixing English and Vietnamese (e.g. "nhac thieu nhi", "be hoc tieng anh").
audio: {} (filled later).`;

const user = `Topic: ${topic}

Zod schema (src/schema.ts):
${schemaSrc}

Example of a valid file in this style:
${example}`;

async function ask(messages: { role: "user" | "assistant"; content: string }[]) {
  if (PROVIDER === "groq") {
    // Groq speaks the OpenAI chat-completions format; free tier is enough for a few videos a day
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("GROQ_API_KEY")}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: system }, ...messages],
        max_completion_tokens: 16000,
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`Groq API ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0].message.content;
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 16000, system, messages }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  return data.content.map((c) => c.text ?? "").join("");
}

const extractJson = (t: string) => {
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  return JSON.parse(t.slice(a, b + 1));
};

(async () => {
  const slug = slugify(topic);
  const messages: { role: "user" | "assistant"; content: string }[] = [{ role: "user", content: user }];
  for (let attempt = 1; attempt <= 3; attempt++) {
    log(`asking ${PROVIDER}:${MODEL} (attempt ${attempt})…`);
    const text = await ask(messages);
    try {
      const v = save(slug, extractJson(text));
      log(`wrote ${contentPath(slug)} — ${v.scenes.length} scenes`);
      log(`next: review the lyrics, then  npx tsx scripts/02-images.ts ${slug}`);
      return;
    } catch (e) {
      log("invalid JSON, asking for a fix:", String(e).slice(0, 400));
      messages.push({ role: "assistant", content: text });
      messages.push({ role: "user", content: `That did not validate:\n${String(e).slice(0, 3000)}\nReturn the full corrected JSON only.` });
    }
  }
  throw new Error("Could not get valid JSON after 3 attempts");
})();
