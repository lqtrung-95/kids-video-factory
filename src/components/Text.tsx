import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { DISPLAY, LYRIC } from "../fonts";
import type { LyricLine } from "../schema";

/** Thick sticker-style outline, robust in headless Chrome (layered text-shadows). */
export const outline = (color: string, w: number) => {
  const s: string[] = [];
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    s.push(`${(Math.cos(a) * w).toFixed(1)}px ${(Math.sin(a) * w).toFixed(1)}px 0 ${color}`);
  }
  s.push(`0 ${w * 0.9}px 0 rgba(0,0,0,0.18)`);
  return s.join(",");
};

/**
 * Font size that makes `text` fit on ONE line within `maxWidth` px (never larger than `base`).
 * Measures the real glyph widths with a canvas once the fonts are loaded; until then (or outside
 * a browser) it uses a conservative estimate. 8% is kept free for the outline and the bounce.
 */
let measureCtx: CanvasRenderingContext2D | null = null;
export const fit = (
  text: string,
  maxWidth: number,
  base: number,
  opts: { upper?: boolean; font?: string; weight?: number } = {},
) => {
  const t = opts.upper ? text.toUpperCase() : text;
  const estimate = Math.min(base, maxWidth / (Math.max(1, [...t].length) * (opts.upper || t === t.toUpperCase() ? 0.78 : 0.62)));
  if (typeof document === "undefined") return estimate;
  const weight = opts.weight ?? 700;
  if (!document.fonts.check(`${weight} 100px Fredoka`)) return estimate;
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return estimate;
  measureCtx.font = `${weight} 100px ${opts.font ?? DISPLAY}`;
  const w100 = measureCtx.measureText(t).width;
  return w100 > 0 ? Math.min(base, (maxWidth * 0.92 * 100) / w100) : estimate;
};

export const usePop =(delay = 0, damping = 11) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, stiffness: 140, mass: 0.8 } });
};

export const PopText: React.FC<{
  children: React.ReactNode;
  size: number;
  color?: string;
  stroke?: string;
  strokeW?: number;
  delay?: number;
  font?: string;
  style?: React.CSSProperties;
  letterBounce?: boolean;
}> = ({ children, size, color = "#fff", stroke, strokeW = 8, delay = 0, font = DISPLAY, style, letterBounce }) => {
  const p = usePop(delay);
  const frame = useCurrentFrame();
  const base: React.CSSProperties = {
    fontFamily: font,
    fontWeight: 700,
    fontSize: size,
    lineHeight: 1.05,
    color,
    textShadow: stroke ? outline(stroke, strokeW) : undefined,
    transform: `scale(${interpolate(p, [0, 1], [0.3, 1])})`,
    opacity: Math.min(1, p * 1.5),
    display: "inline-block",
    whiteSpace: "pre-wrap",
    ...style,
  };
  if (letterBounce && typeof children === "string") {
    // each letter is its own inline-block, so the browser could otherwise break a word mid-way
    return (
      <span style={{ ...base, whiteSpace: "nowrap" }}>
        {[...children].map((ch, i) => (
          <span
            key={i}
            style={{ display: "inline-block", transform: `translateY(${Math.sin(frame / 6 + i * 0.6) * size * 0.04}px)` }}
          >
            {ch === " " ? " " : ch}
          </span>
        ))}
      </span>
    );
  }
  return <span style={base}>{children}</span>;
};

/** Seconds a word lights up before its sung onset (karaoke apps use ~0.1 s). */
export const KARAOKE_LEAD = 0.12;

/** Distribute word timings evenly when no forced-alignment data is present. */
export const timeLines = (lines: LyricLine[], duration: number) => {
  const lead = 0.25;
  const usable = Math.max(0.5, duration - lead - 0.35);
  const totalWords = lines.reduce((n, l) => n + l.text.split(/\s+/).length, 0);
  let t = lead;
  return lines.map((l) => {
    if (l.words?.length) return l.words;
    const ws = l.text.split(/\s+/);
    return ws.map((w) => {
      const d = usable / totalWords;
      const out = { w, start: t, end: t + d };
      t += d;
      return out;
    });
  });
};

/**
 * Lyrics with karaoke highlight. Each line appears with its first word, the sung word
 * turns orange and pops. Kids can follow the text while singing.
 */
export const Karaoke: React.FC<{
  lines: LyricLine[];
  duration: number;
  size?: number;
  mode?: "outline" | "box";
  align?: "center" | "left";
}> = ({ lines, duration, size = 78, mode = "outline", align = "center" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  // safety net: a word timed at/after the scene cut would never light up — pull it in so every
  // word is highlighted at least briefly before the scene changes
  const latest = Math.max(0, duration - 0.3);
  const timed = timeLines(lines, duration).map((ws) => ws.map((w) => (w.start > latest ? { ...w, start: latest } : w)));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : "flex-start", gap: size * 0.1 }}>
      {timed.map((words, li) => {
        const lineStart = words[0]?.start ?? 0;
        const vis = interpolate(t, [lineStart - 0.35, lineStart - 0.1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div
            key={li}
            style={{
              opacity: vis,
              transform: `translateY(${(1 - vis) * 20}px)`,
              background: mode === "box" ? "#FFE81A" : undefined,
              padding: mode === "box" ? `${size * 0.04}px ${size * 0.3}px` : undefined,
              borderRadius: 10,
              textAlign: align,
            }}
          >
            {words.map((w, wi) => {
              // light each word slightly before it is sung — on-the-beat highlights are perceived as late
              const ws = w.start - KARAOKE_LEAD;
              const on = t >= ws;
              const k = interpolate(t, [ws, ws + 0.12, ws + 0.3], [1, 1.14, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <span
                  key={wi}
                  style={{
                    display: "inline-block",
                    fontFamily: LYRIC,
                    fontWeight: 800,
                    fontSize: size,
                    lineHeight: 1.15,
                    marginRight: size * 0.24,
                    color: on ? (mode === "box" ? "#D62828" : "#FF7A00") : "#1B1B1B",
                    textShadow: mode === "outline" ? outline("#FFFFFF", size * 0.09) : undefined,
                    transform: `scale(${k})`,
                  }}
                >
                  {w.w}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
