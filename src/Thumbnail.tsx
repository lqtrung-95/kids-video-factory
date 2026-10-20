/**
 * YouTube thumbnail (1280×720): sunburst background, big two-line title, the video's subjects as
 * big stickers and two of the kids. One layout for every video so the channel is recognisable;
 * the colour theme changes per video. Overrides: meta.thumbnail.title / meta.thumbnail.items.
 */
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { Kid } from "./components/Kid";
import { outline } from "./components/Text";
import { DISPLAY, loadFonts } from "./fonts";
import type { Character, Scene, VideoProps } from "./schema";

loadFonts();

const EMOJI = `"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
const THEMES = [
  { a: "#FFD84D", b: "#FFC629", glow: "#FFF4C2" },
  { a: "#7FD7F7", b: "#5CC6F0", glow: "#E4F8FF" },
  { a: "#FF9EC4", b: "#FF85B3", glow: "#FFE6F0" },
  { a: "#9BE38A", b: "#7CD76A", glow: "#EBFBE6" },
  { a: "#FFB067", b: "#FF9A45", glow: "#FFF0E0" },
];
const WORD_COLORS = ["#FF3D6E", "#1E7FE0", "#F26B21", "#22A65A", "#9B4FCB"];
const DEFAULT_KIDS: Character[] = [
  { look: { top: "#F26B21", bottom: "#2F86C9", skin: "#8D5A3B", hair: "#1B1B1B", outfit: "dress", hairStyle: "pigtails", accent: "#FFFFFF" } as never },
  { look: { top: "#4DB35E", bottom: "#6D4C41", hair: "#F2C94C" } as never },
];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

type Item = { emoji?: string; image?: string };

/** The video's subjects, best pictures first (AI images, then the card emojis). */
export const thumbItems = (v: VideoProps): Item[] => {
  if (v.meta.thumbnail?.items?.length) return v.meta.thumbnail.items.map((x) => (/\.(png|jpe?g|webp)$/i.test(x) ? { image: x } : { emoji: x }));
  const out: Item[] = [];
  const add = (it: Item) => {
    const key = it.image ?? it.emoji;
    if (key && !out.some((o) => (o.image ?? o.emoji) === key)) out.push(it);
  };
  const scenes = v.scenes as Scene[];
  for (const s of scenes) if (s.type === "vocab" && s.image) add({ image: s.image });
  for (const s of scenes) {
    if (s.type === "vocab" && s.emoji) add({ emoji: s.emoji });
    else if (s.type === "count" || s.type === "letter") s.emoji && add({ emoji: s.emoji });
    else if (s.type === "color") add({ emoji: s.items[0] });
    else if (s.type === "country" && s.pet?.emoji) add({ emoji: s.pet.emoji });
  }
  for (const s of scenes) if (s.type === "lyric") s.emojis.forEach((e) => add({ emoji: e }));
  return out.slice(0, 3);
};

const splitTitle = (t: string): string[] => {
  const w = t.split(/\s+/);
  if (w.length < 3 || t.length < 14) return [t];
  let best = 1;
  let bestD = Infinity;
  for (let i = 1; i < w.length; i++) {
    const d = Math.abs(w.slice(0, i).join(" ").length - w.slice(i).join(" ").length);
    if (d < bestD) [best, bestD] = [i, d];
  }
  return [w.slice(0, best).join(" "), w.slice(best).join(" ")];
};

const Sticker: React.FC<{ it: Item; size: number; rot: number }> = ({ it, size, rot }) => (
  <div style={{ transform: `rotate(${rot}deg)`, filter: "drop-shadow(0 0 0 #fff) drop-shadow(0 10px 0 rgba(0,0,0,0.18))" }}>
    {it.image ? (
      <Img src={staticFile(it.image)} style={{ width: size, height: size, objectFit: "contain", filter: "drop-shadow(0 0 6px #fff) drop-shadow(0 0 6px #fff)" }} />
    ) : (
      <div style={{ fontFamily: EMOJI, fontSize: size * 0.86, lineHeight: 1, width: size, textAlign: "center" }}>{it.emoji}</div>
    )}
  </div>
);

export const Thumbnail: React.FC<VideoProps> = (v) => {
  const title = (v.meta.thumbnail?.title ?? v.meta.title.split("|")[0]).trim();
  const theme = THEMES[hash(title) % THEMES.length];
  const lines = splitTitle(title);
  const longest = Math.max(...lines.map((l) => l.length));
  const size = Math.min(lines.length > 1 ? 132 : 160, Math.floor(1180 / (longest * 0.56)));
  const items = thumbItems(v);
  const firstLyric = v.scenes.find((s) => s.type === "lyric") as Extract<Scene, { type: "lyric" }> | undefined;
  const kids = (firstLyric?.characters.length ? firstLyric.characters : DEFAULT_KIDS).slice(0, 2);
  let wi = 0;

  return (
    <AbsoluteFill style={{ background: theme.a, overflow: "hidden" }}>
      {/* sunburst */}
      <AbsoluteFill
        style={{
          background: `repeating-conic-gradient(from 0deg at 50% 62%, ${theme.a} 0deg 10deg, ${theme.b} 10deg 20deg)`,
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 62%, ${theme.glow} 0%, transparent 45%)` }} />

      {/* title */}
      <AbsoluteFill style={{ alignItems: "center", paddingTop: lines.length > 1 ? 18 : 40 }}>
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: size,
              lineHeight: 1.02,
              whiteSpace: "nowrap",
              textShadow: outline("#FFFFFF", 9) + "," + outline("#1B1B1B", 14),
              transform: `rotate(${i % 2 ? 1.5 : -1.5}deg)`,
            }}
          >
            {l.split(" ").map((w, k) => (
              <span key={k} style={{ color: WORD_COLORS[wi++ % WORD_COLORS.length] }}>
                {w}
                {k < l.split(" ").length - 1 ? " " : ""}
              </span>
            ))}
          </div>
        ))}
      </AbsoluteFill>

      {/* subjects */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 30,
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          gap: items.length > 2 ? 10 : 40,
        }}
      >
        {items.map((it, i) => (
          <Sticker key={i} it={it} size={items.length > 2 ? (i === 1 ? (lines.length > 1 ? 320 : 340) : lines.length > 1 ? 270 : 280) : 340} rot={[-8, 4, 9][i]} />
        ))}
      </div>

      {/* kids in the corners */}
      {kids.map((c, i) => (
        <div key={i} style={{ position: "absolute", bottom: -30, [i ? "right" : "left"]: -10 }}>
          <Kid c={c} size={440} mirror={i === 1} />
        </div>
      ))}

    </AbsoluteFill>
  );
};
