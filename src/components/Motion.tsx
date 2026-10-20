/**
 * Extra motion for livelier videos: scene transitions, background particles, a confetti burst,
 * and a beat-synced pulse. Everything is deterministic (seeded), so renders are repeatable.
 */
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// ───────────────────────────── seeded random
const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// ───────────────────────────── transitions (scene entrance)
export const TRANSITIONS = ["pop", "slide", "iris", "zoom", "swing", "slideUp"] as const;
export type Transition = (typeof TRANSITIONS)[number];

/** Wraps a scene and animates its entrance over the first ~12 frames. */
export const Entrance: React.FC<{ kind: Transition; children: React.ReactNode; seed?: number }> = ({
  kind,
  children,
  seed = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 15, stiffness: 120, mass: 0.7 } });
  const lin = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const dir = rand(seed) > 0.5 ? 1 : -1;
  let style: React.CSSProperties = {};
  switch (kind) {
    case "slide":
      style = { transform: `translateX(${(1 - p) * dir * width}px)` };
      break;
    case "slideUp":
      style = { transform: `translateY(${(1 - p) * height}px)` };
      break;
    case "iris": {
      const r = lin * Math.hypot(width, height) * 0.6;
      style = { clipPath: `circle(${r}px at 50% 50%)` };
      break;
    }
    case "zoom":
      style = { transform: `scale(${0.4 + p * 0.6})`, opacity: Math.min(1, lin * 1.5) };
      break;
    case "swing":
      style = { transform: `perspective(2000px) rotateY(${(1 - p) * 70 * dir}deg)`, transformOrigin: dir > 0 ? "left center" : "right center" };
      break;
    default: // pop
      style = { opacity: 0.3 + lin * 0.7, transform: `scale(${1.06 - lin * 0.06})` };
  }
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

/** Slow camera drift (Ken Burns) so no scene is ever completely still. */
export const Drift: React.FC<{ children: React.ReactNode; seed?: number; amount?: number; durationInFrames: number }> = ({
  children,
  seed = 0,
  amount = 1,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const z = 1 + 0.04 * amount * Math.min(1, frame / Math.max(1, durationInFrames)); // ≤ 4 % zoom over the scene
  const dx = Math.sin(frame / 90 + seed) * 8 * amount;
  const dy = Math.cos(frame / 110 + seed) * 5 * amount;
  return <AbsoluteFill style={{ transform: `scale(${z}) translate(${dx}px, ${dy}px)` }}>{children}</AbsoluteFill>;
};

// ───────────────────────────── particles
export const FX = ["none", "bubbles", "petals", "sparkles", "confetti", "snow", "hearts", "notes"] as const;
export type Fx = (typeof FX)[number];

const COLORS = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#B983FF", "#FF8FB1"];

/** Ambient particles drifting across the scene. */
export const Particles: React.FC<{ kind: Fx; count?: number; seed?: number }> = ({ kind, count = 22, seed = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  if (kind === "none") return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={width} height={height}>
        {Array.from({ length: count }).map((_, i) => {
          const r0 = rand(seed * 100 + i);
          const r1 = rand(seed * 200 + i);
          const r2 = rand(seed * 300 + i);
          const size = 10 + r1 * 26;
          const speed = 0.6 + r2 * 1.4;
          if (kind === "bubbles") {
            const x = r0 * width + Math.sin(frame / 20 + i) * 18;
            const y = height + 60 - ((frame * speed * 2 + r1 * height * 1.4) % (height + 120));
            return <circle key={i} cx={x} cy={y} r={size * 0.8} fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.8)" strokeWidth={3} />;
          }
          if (kind === "snow") {
            const x = r0 * width + Math.sin(frame / 25 + i) * 25;
            const y = ((frame * speed * 1.5 + r1 * height * 1.4) % (height + 80)) - 40;
            return <circle key={i} cx={x} cy={y} r={size * 0.35} fill="rgba(255,255,255,0.9)" />;
          }
          if (kind === "petals" || kind === "confetti") {
            const x = r0 * width + Math.sin(frame / 18 + i) * 40;
            const y = ((frame * speed * (kind === "confetti" ? 3 : 1.6) + r1 * height * 1.4) % (height + 80)) - 40;
            const rot = frame * (2 + r2 * 4) + i * 40;
            const c = kind === "petals" ? ["#FFB7C5", "#FFD1DC", "#FFF0F5", "#FFC8DD"][i % 4] : COLORS[i % COLORS.length];
            return kind === "petals" ? (
              <ellipse key={i} cx={x} cy={y} rx={size * 0.45} ry={size * 0.28} fill={c} transform={`rotate(${rot} ${x} ${y})`} />
            ) : (
              <rect key={i} x={x} y={y} width={size * 0.5} height={size * 0.9} fill={c} transform={`rotate(${rot} ${x} ${y})`} rx={2} />
            );
          }
          if (kind === "sparkles") {
            const x = r0 * width;
            const y = r1 * height * 0.75;
            const tw = (Math.sin(frame / 8 + i * 1.7) + 1) / 2;
            const s = size * 0.6 * tw;
            return (
              <path
                key={i}
                d={`M${x} ${y - s} L${x + s * 0.25} ${y - s * 0.25} L${x + s} ${y} L${x + s * 0.25} ${y + s * 0.25} L${x} ${y + s} L${x - s * 0.25} ${y + s * 0.25} L${x - s} ${y} L${x - s * 0.25} ${y - s * 0.25} Z`}
                fill="#FFF6B0"
                opacity={0.4 + tw * 0.6}
              />
            );
          }
          // hearts / notes float upward
          const x = r0 * width + Math.sin(frame / 22 + i) * 30;
          const y = height + 60 - ((frame * speed * 1.4 + r1 * height * 1.4) % (height + 120));
          const glyph = kind === "hearts" ? "♥" : ["♪", "♫", "♩"][i % 3];
          return (
            <text key={i} x={x} y={y} fontSize={size * 1.6} fill={kind === "hearts" ? COLORS[i % 2 ? 0 : 5] : "rgba(255,255,255,0.85)"} fontFamily="sans-serif">
              {glyph}
            </text>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** One-shot confetti explosion from the bottom corners (chorus, reveals). */
export const ConfettiBurst: React.FC<{ at?: number; pieces?: number }> = ({ at = 0, pieces = 70 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = (frame - at) / fps;
  if (t < 0 || t > 2.6) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={width} height={height}>
        {Array.from({ length: pieces }).map((_, i) => {
          const left = i % 2 === 0;
          const ang = (left ? -60 : -120) + (rand(i * 7) - 0.5) * 50;
          const v = 1500 + rand(i * 13) * 900;
          const vx = Math.cos((ang * Math.PI) / 180) * v;
          const vy = Math.sin((ang * Math.PI) / 180) * v;
          const x = (left ? 0 : width) + vx * t;
          const y = height + vy * t + 1400 * t * t;
          const rot = t * 720 * (rand(i) > 0.5 ? 1 : -1);
          const o = interpolate(t, [0, 2, 2.6], [1, 1, 0]);
          return <rect key={i} x={x} y={y} width={14} height={24} rx={3} fill={COLORS[i % COLORS.length]} opacity={o} transform={`rotate(${rot} ${x} ${y})`} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** 1 → ~1.06 on every beat (fast attack, smooth release). */
export const beatPulse = (frame: number, fps: number, beat: number, strength = 0.06) => {
  if (!beat) return 1;
  const ph = ((frame / fps) % beat) / beat;
  return 1 + strength * Math.exp(-ph * 6);
};

/** Default particles for a background, so every song scene has gentle motion. */
export const fxFor = (bg: string, chorus: boolean): Fx => {
  if (chorus) return "confetti";
  switch (bg) {
    case "sea":
      return "bubbles";
    case "meadow":
      return "petals";
    case "sky":
    case "globe":
      return "sparkles";
    case "blocks":
      return "notes";
    case "desert":
      return "none";
    default:
      return "sparkles";
  }
};
