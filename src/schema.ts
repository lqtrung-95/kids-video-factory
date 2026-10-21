import { z } from "zod";

/**
 * One JSON file = one video. Every pipeline step reads/writes this shape.
 * Times are in seconds. Asset paths are relative to /public (staticFile).
 */

export const kidLook = z.object({
  skin: z.string().default("#F8D5B8"),
  hair: z.string().default("#3B2417"),
  hairStyle: z.enum(["short", "bob", "long", "bun", "pigtails"]).default("short"),
  outfit: z.enum(["shirtPants", "dress", "tunic"]).default("shirtPants"),
  top: z.string().default("#E63946"),
  bottom: z.string().default("#1D3557"),
  accent: z.string().default("#FFFFFF"),
  hat: z
    .enum(["none", "conical", "beret", "sombrero", "flowerCrown", "kokoshnik", "bow", "headscarf"])
    .default("none"),
  hatColor: z.string().optional(),
  flag: z.string().optional(), // ISO 3166-1 alpha-2, lower case (vn, fr, jp...)
});
export type KidLook = z.infer<typeof kidLook>;

/** A character is either a generated image (AI) or the built-in vector kid. */
export const character = z.object({
  image: z.string().optional(),
  look: kidLook.optional(),
});
export type Character = z.infer<typeof character>;

export const word = z.object({ w: z.string(), start: z.number(), end: z.number() });
export const lyricLine = z.object({
  text: z.string(),
  words: z.array(word).optional(), // filled by scripts/align.py; else evenly spaced
});
export type LyricLine = z.infer<typeof lyricLine>;

export const background = z.object({
  kind: z.enum(["color", "sky", "image", "video", "globe", "blocks", "sea", "desert", "meadow"]).default("sky"),
  color: z.string().optional(),
  src: z.string().optional(),
});

const base = {
  id: z.string().optional(),
  duration: z.number().positive(),
  say: z.string().optional(), // narration text → scripts/03-voice.ts turns it into `voice`
  voice: z.string().optional(), // narration mp3 played at scene start
  voiceOffset: z.number().default(0.4),
  imagePrompt: z.string().optional(), // used by scripts/generate-images.ts
  dub: z.record(z.string(), z.string()).optional(), // narration in other languages: { "vi": "…", "es": "…" } (09-dub)
  // motion (optional — chosen automatically when left out)
  transition: z.enum(["auto", "pop", "slide", "iris", "zoom", "swing", "slideUp"]).default("auto"),
  fx: z.enum(["auto", "none", "bubbles", "petals", "sparkles", "confetti", "snow", "hearts", "notes"]).default("auto"),
};

export const introScene = z.object({
  ...base,
  type: z.literal("intro"),
  title: z.string(),
  subtitle: z.string().default("KIDS CHANNEL"),
  handle: z.string().optional(),
});

export const lyricScene = z.object({
  ...base,
  type: z.literal("lyric"),
  background,
  characters: z.array(character).default([]),
  emojis: z.array(z.string()).default([]), // big bouncing emoji next to the kids (animals, fruits…)
  lines: z.array(lyricLine),
  textPosition: z.enum(["bottom", "left", "top"]).default("bottom"),
  textStyle: z.enum(["outline", "box"]).default("outline"),
  // movement songs: kids do this on the beat while the line is sung ("Jump, jump, jump!")
  action: z.enum(["jump", "clap", "spin", "wiggle", "stomp", "wave"]).optional(),
  beat: z.number().default(0.545), // seconds per beat; 04-song sets it from the real song
});

export const titleScene = z.object({
  ...base,
  type: z.literal("title"),
  small: z.array(z.string()).default([]),
  big: z.string(),
});

export const countryScene = z.object({
  ...base,
  type: z.literal("country"),
  layout: z.enum(["quad", "poster"]).default("poster"),
  country: z.string(), // display name
  flag: z.string(), // iso code
  greeting: z.string(), // "Xin chào"
  native: z.string().optional(), // native script if not Latin: "こんにちは"
  romanization: z.string().optional(),
  bg: z.string().optional(),
  characters: z.array(character).default([]),
  /** optional animal/object shown on the card (e.g. the dog making the sound) */
  pet: z.object({ emoji: z.string().optional(), image: z.string().optional() }).optional(),
  props:z.array(z.object({ image: z.string(), x: z.number(), y: z.number(), size: z.number().default(260) })).default([]),
});

/** Generic vocabulary card (dinosaurs, animals, fruits...): one big picture + the word. */
export const vocabScene = z.object({
  ...base,
  type: z.literal("vocab"),
  word: z.string(),
  sub: z.string().optional(), // e.g. "Tyrannosaurus Rex" / phonics "T-REX"
  image: z.string().optional(), // transparent PNG from scripts/02-images.ts
  emoji: z.string().optional(), // quick placeholder picture when there is no image yet
  guess: z.string().optional(), // "MOO!" → silhouette + "Who says MOO?" then reveal (guessing game)
  reveal: z.number().default(3), // seconds into the scene when the answer is revealed
  bg: z.string().optional(),
  background: background.optional(),
  side: z.enum(["left", "right"]).default("right"),
});

// ───── formats from the 2026 research: counting, colors, ABC/phonics, action (dance/freeze) songs

/** "One, two, three…" — N objects pop in one by one while the big number counts up. */
export const countScene = z.object({
  ...base,
  type: z.literal("count"),
  number: z.number().int().min(1).max(10),
  emoji: z.string(), // the object being counted 🍎
  word: z.string(), // "apples"
  bg: z.string().optional(),
  startAt: z.number().default(0.35), // seconds before the first object appears
});

/** A color: big paint splash + 3 things that have that color. */
export const colorScene = z.object({
  ...base,
  type: z.literal("color"),
  name: z.string(), // "RED"
  hex: z.string(), // "#E53935"
  items: z.array(z.string()).min(1).max(4), // emojis 🍓🚒🍎
  bg: z.string().optional(),
});

/** ABC / phonics card: "A a — A is for Apple". */
export const letterScene = z.object({
  ...base,
  type: z.literal("letter"),
  letter: z.string().length(1),
  word: z.string(), // "Apple"
  emoji: z.string().optional(),
  image: z.string().optional(),
  sound: z.string().optional(), // phonics "/æ/"
  bg: z.string().optional(),
});

/** Movement songs (Clap/Jump/Freeze dance): kids do the action on the beat. */
export const actionScene = z.object({
  ...base,
  type: z.literal("action"),
  action: z.enum(["jump", "clap", "spin", "wiggle", "stomp", "wave", "freeze"]),
  word: z.string(), // "JUMP!"
  beat: z.number().default(0.545), // seconds per beat (110 bpm); 04-song can set it from the song
  freezeAt: z.number().optional(), // freeze: seconds into the scene when everyone stops
  characters: z.array(character).default([]),
  bg: z.string().optional(),
});

export const outroScene = z.object({
  ...base,
  type: z.literal("outro"),
  text: z.string().default("SPREAD THE LOVE"),
  characters: z.array(character).default([]),
});

export const subscribeScene = z.object({
  ...base,
  type: z.literal("subscribe"),
  text: z.string().default("SUBSCRIBE"),
  sub: z.string().default("OUR CHANNEL"),
  handle: z.string().optional(),
});

/** Your own video clip (channel intro/outro). Added by scripts/brand.ts from public/brand/. */
export const clipScene = z.object({
  ...base,
  type: z.literal("clip"),
  src: z.string(), // path in /public
  role: z.enum(["intro", "outro", "other"]).default("other"),
  volume: z.number().default(1),
});

export const scene = z.discriminatedUnion("type", [
  introScene,
  lyricScene,
  titleScene,
  countryScene,
  vocabScene,
  countScene,
  colorScene,
  letterScene,
  actionScene,
  outroScene,
  subscribeScene,
  clipScene,
]);
export type Scene = z.infer<typeof scene>;

export const videoSchema = z.object({
  meta: z.object({
    title: z.string(),
    description: z.string().default(""),
    tags: z.array(z.string()).default([]),
    channel: z.string().default("Meo with Pi"),
    madeForKids: z.boolean().default(true),
    // optional thumbnail overrides (defaults: title before "|", pictures taken from the scenes)
    thumbnail: z
      .object({
        title: z.string().optional(),
        items: z.array(z.string()).optional(),
        layout: z.enum(["classic", "hero", "pop"]).optional(), // the main thumbnail; the others are rendered as A/B variants
      })
      .optional(),
    playlists: z.array(z.string()).default([]), // YouTube playlists this video goes into (06-upload, 08-compile --theme)
    musicStyle: z.string().optional(), // id from scripts/music.ts — picked once, so the channel rotates styles
  }),
  audio: z
    .object({
      song: z.string().optional(), // Suno track
      songStart: z.number().default(0), // where the song starts on the timeline
      songVolume: z.number().default(1),
      songEnd: z.number().optional(), // seconds into the song where it stops (fade-out); cuts a long instrumental tail
      bgm: z.string().optional(), // loop for the non-song parts (best: the song's instrumental from Suno)
      bgmVolume: z.number().default(0.35),
      bgmDuck: z.number().default(0.45), // bgm multiplier while a narration scene plays
      bgmDuration: z.number().optional(), // filled automatically at render time
      // every time the song is heard: the main song part, chorus breaks, "sing again" (src/arrange.ts)
      songPlays: z.array(z.object({ at: z.number(), from: z.number(), dur: z.number() })).optional(),
    })
    .default({}),
  scenes: z.array(scene).min(1),
  // your own intro/outro clips. Default: public/brand/intro.mp4 and public/brand/outro.mp4 are used
  // automatically when they exist. A path uses that clip for this video; false turns it off.
  brand: z
    .object({
      intro: z.union([z.string(), z.literal(false)]).optional(),
      outro: z.union([z.string(), z.literal(false)]).optional(),
      // what the outro clip replaces: "both" = the built-in outro + subscribe cards, "subscribe" = keep "Spread the love"
      outroReplaces: z.enum(["both", "subscribe", "none"]).default("both"),
    })
    .default({}),
  // structure added at render time (src/arrange.ts) — never written back to the JSON
  extras: z
    .object({
      singAgain: z.boolean().default(true), // replay the whole song before the outro
      chorusBreaks: z.boolean().default(true), // short chorus between groups of learning cards
      maxBreaks: z.number().int().min(0).default(3),
    })
    .default({}),
});
export type VideoProps = z.infer<typeof videoSchema>;

export const FPS = 30;
export const sceneStarts = (scenes: Scene[]) => {
  const starts: number[] = [];
  let t = 0;
  for (const s of scenes) {
    starts.push(t);
    t += s.duration;
  }
  return { starts, total: t };
};
