/**
 * Render-time structure on top of the JSON (nothing here is saved back to content/<slug>.json):
 *  - chorus breaks : the chorus comes back for a few seconds between groups of learning cards,
 *                    so a 3-minute learning part has highs and lows instead of one long list
 *  - sing again    : the whole song plays a second time before the outro ("Let's sing it again!")
 *  - chapters      : one YouTube chapter per group (Dog 🐶, Cat 🐱 / A–D / Red, Orange…)
 * Inserted scenes get ids starting with "auto:", which also makes arrange() idempotent.
 */
import { sceneStarts, type Scene, type VideoProps } from "./schema";

const LEARN = new Set(["vocab", "country", "count", "color", "letter", "action"]);
type Lyric = Extract<Scene, { type: "lyric" }>;
type Play = { at: number; from: number; dur: number };

const isAuto = (s: Scene) => !!s.id?.startsWith("auto:");

/** Indices (into scenes) where a chorus break goes: before these scenes. */
const breakPoints = (scenes: Scene[], max: number): number[] => {
  const learn = scenes.flatMap((s, i) => (LEARN.has(s.type) ? [i] : []));
  if (learn.length < 6 || max <= 0) return [];
  // grouped cards (a vocab card introducing several country cards): break before each group
  const heads = learn.filter((i) => scenes[i].type === "vocab" && scenes[i + 1]?.type === "country");
  if (heads.length >= 2) {
    const later = heads.slice(1);
    const step = Math.max(1, Math.ceil(later.length / max));
    return later.filter((_, k) => k % step === 0).slice(0, max);
  }
  // a plain run of cards: evenly spaced, at least ~5 cards apart
  const n = Math.min(max, Math.floor(learn.length / 5));
  const out: number[] = [];
  for (let j = 1; j <= n; j++) {
    let k = Math.round((learn.length * j) / (n + 1));
    // freeze dance: keep each "move → FREEZE" pair together
    if (scenes[learn[k]]?.type === "action" && (scenes[learn[k]] as Extract<Scene, { type: "action" }>).action === "freeze") k++;
    if (k > 0 && k < learn.length) out.push(learn[k]);
  }
  return [...new Set(out)];
};

export const arrange = (v: VideoProps): VideoProps => {
  if (v.scenes.some(isAuto) || v.audio.songPlays) return v;
  const lyricIdx = v.scenes.flatMap((s, i) => (s.type === "lyric" ? [i] : []));
  const song = v.audio.song;
  const timed = lyricIdx.length && lyricIdx.every((i) => (v.scenes[i] as Lyric).lines.every((l) => l.words?.length));
  if (!song || !timed) return v; // nothing to replay before the song is in place and aligned

  const { starts } = sceneStarts(v.scenes);
  const songStart = v.audio.songStart;
  const songPart = lyricIdx.reduce((t, i) => t + v.scenes[i].duration, 0);
  const mainDur = v.audio.songEnd ?? songPart;
  const extras = v.extras ?? { singAgain: true, chorusBreaks: true, maxBreaks: 3 };

  // the first chorus (box-style lyric scene) is what comes back between the card groups
  const chorusI = lyricIdx.find((i) => (v.scenes[i] as Lyric).textStyle === "box");
  const chorus = chorusI !== undefined ? (v.scenes[chorusI] as Lyric) : undefined;
  const chorusFrom = chorusI !== undefined ? starts[chorusI] - songStart : 0;
  const breaks = extras.chorusBreaks && chorus && chorus.duration >= 3 ? new Set(breakPoints(v.scenes, extras.maxBreaks)) : new Set<number>();

  const lastLearn = v.scenes.reduce((m, s, i) => (LEARN.has(s.type) ? i : m), -1);
  const singAgain = extras.singAgain && lastLearn > lyricIdx[lyricIdx.length - 1];

  const out: Scene[] = [];
  const pending: { id: string; from: number; dur: number }[] = [];
  v.scenes.forEach((s, i) => {
    if (breaks.has(i) && chorus) {
      const id = `auto:chorus-${i}`;
      out.push({ ...chorus, id, transition: "zoom" });
      pending.push({ id, from: chorusFrom, dur: chorus.duration });
    }
    out.push(s);
    if (singAgain && i === lastLearn) {
      out.push({
        id: "auto:sing-title",
        type: "title",
        duration: 3.5,
        small: ["Let's sing"],
        big: "it again!",
        voiceOffset: 0.4,
        transition: "iris",
        fx: "notes",
      } as Scene);
      lyricIdx.forEach((li, k) => out.push({ ...v.scenes[li], id: `auto:sing-${k}`, voice: undefined } as Scene));
      pending.push({ id: "auto:sing-0", from: 0, dur: mainDur });
    }
  });

  const s2 = sceneStarts(out).starts;
  const at = (id: string) => s2[out.findIndex((s) => s.id === id)];
  const songPlays: Play[] = [{ at: songStart, from: 0, dur: mainDur }, ...pending.map((p) => ({ at: at(p.id), from: p.from, dur: p.dur }))];
  return { ...v, scenes: out, audio: { ...v.audio, songPlays } };
};

// ───────────────────────────── chapters

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
const mmss = (t: number) =>
  `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

const cardLabel = (group: Scene[]): string => {
  const a = group[0];
  const b = group[group.length - 1];
  switch (a.type) {
    case "letter":
      return `Letters ${a.letter}–${(b as typeof a).letter}`;
    case "count":
      return `Numbers ${a.number}–${(b as typeof a).number}`;
    case "color":
      return group.map((s) => cap((s as typeof a).name)).join(", ");
    case "action":
      return "Freeze Dance";
    case "vocab": {
      const words = group.map((s) => cap((s as typeof a).word.replace(/!$/, "")));
      return words.length > 4 ? `${words.slice(0, 3).join(", ")}…` : words.join(", ");
    }
    default:
      return "Let's learn";
  }
};

/** YouTube chapters (first at 00:00, each ≥ 10 s). */
export const chapters = (v: VideoProps): string[] => {
  const { starts, total } = sceneStarts(v.scenes);
  const title = v.meta.title.split("|")[0].trim();
  const marks: { t: number; label: string }[] = [{ t: 0, label: "Intro" }];
  const firstLyric = v.scenes.findIndex((s) => s.type === "lyric");
  if (firstLyric >= 0) marks.push({ t: starts[firstLyric], label: `${title} Song 🎵` });

  let run: number[] = [];
  const flush = () => {
    // split a run of cards into chapters of ≥ 15 s and ≥ 3 cards
    let g: number[] = [];
    let dur = 0;
    run.forEach((i, k) => {
      g.push(i);
      dur += v.scenes[i].duration;
      const left = run.length - k - 1;
      if ((dur >= 15 && g.length >= 3 && left >= 3) || left === 0) {
        marks.push({ t: starts[g[0]], label: cardLabel(g.map((j) => v.scenes[j])) });
        g = [];
        dur = 0;
      }
    });
    run = [];
  };

  v.scenes.forEach((s, i) => {
    if (s.id === "auto:sing-title") {
      flush();
      marks.push({ t: starts[i], label: "Sing Along Again 🎤" });
    } else if (s.type === "vocab" && v.scenes[i + 1]?.type === "country") {
      flush();
      marks.push({ t: starts[i], label: `${cap(s.word)} ${s.emoji ?? ""}`.trim() });
    } else if (s.type === "country" || isAuto(s)) {
      // part of the current group (country cards) or a short chorus break
    } else if (LEARN.has(s.type)) {
      run.push(i);
    } else {
      flush();
      if (s.type === "title" && i > firstLyric && !marks.some((m) => m.label.includes("Sing Along"))) {
        const label = [...s.small, s.big].join(" ").replace(/\s+/g, " ").trim();
        if (/your turn/i.test(label)) marks.push({ t: starts[i], label: "Your Turn! 💬" });
        else if (marks.length === 2) marks.push({ t: starts[i], label: cap(label) });
      }
    }
  });
  flush();

  // YouTube: chapters must be ≥ 10 s — drop any that is too short (merges into the previous)
  marks.sort((a, b) => a.t - b.t);
  const kept: typeof marks = [];
  marks.forEach((m, k) => {
    const next = marks[k + 1]?.t ?? total;
    if (k === 0 || next - m.t >= 10) kept.push(m);
  });
  return kept.map((m) => `${mmss(m.t)} ${m.label}`);
};
