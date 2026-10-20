/**
 * Scene types for the formats that dominate kids' YouTube in 2026:
 *   count  – counting songs ("1, 2, 3…")
 *   color  – color songs
 *   letter – ABC / phonics songs
 *   action – movement songs (jump / clap / spin / freeze dance)
 * All of them work with emoji only, so a video needs no paid image generation.
 */
import React from "react";
import { AbsoluteFill, Freeze, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Doodles, PALETTE } from "../components/Decor";
import { Kid } from "../components/Kid";
import { PopText, fit, outline, usePop } from "../components/Text";
import { DISPLAY } from "../fonts";
import type { Character, Scene } from "../schema";

type S<T extends Scene["type"]> = Extract<Scene, { type: T }>;
const EMOJI = `"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;

const Emo: React.FC<{ e: string; size: number; style?: React.CSSProperties }> = ({ e, size, style }) => (
  <div style={{ fontFamily: EMOJI, fontSize: size, lineHeight: 1, ...style }}>{e}</div>
);

const DEFAULT_KIDS: Character[] = [
  { look: { top: "#F26B21", bottom: "#2F86C9", skin: "#8D5A3B", hair: "#1B1B1B", outfit: "dress", hairStyle: "pigtails", accent: "#FFFFFF" } as Character["look"] },
  { look: { top: "#4DB35E", bottom: "#6D4C41", hair: "#F2C94C" } as Character["look"] },
  { look: { top: "#9B4FCB", bottom: "#1D3557", skin: "#C68E68", hair: "#1B1B1B", outfit: "dress", hairStyle: "bob", accent: "#FFD6F0" } as Character["look"] },
];

/** Soft confetti dots so flat backgrounds don't look empty. */
const Dots: React.FC<{ color?: string }> = ({ color = "rgba(255,255,255,0.35)" }) => {
  const frame = useCurrentFrame();
  return (
    <svg width="1920" height="1080" style={{ position: "absolute" }}>
      {Array.from({ length: 18 }).map((_, i) => {
        const x = (i * 337) % 1920;
        const y = ((i * 211) % 1080) + Math.sin(frame / 20 + i) * 12;
        return <circle key={i} cx={x} cy={y} r={14 + (i % 4) * 10} fill={color} />;
      })}
    </svg>
  );
};

// ───────────────────────────── count
export const CountScene: React.FC<{ s: S<"count"> }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  // objects appear evenly between startAt and ~80% of the scene, so the last one is seen for a while
  const step = Math.max(0.35, (s.duration * 0.8 - s.startAt) / s.number);
  const shown = Math.max(0, Math.min(s.number, Math.floor((t - s.startAt) / step) + 1));
  const perRow = s.number <= 5 ? s.number : Math.ceil(s.number / 2);
  const size = s.number <= 3 ? 230 : s.number <= 5 ? 190 : 150;
  const numPop = interpolate(t - (s.startAt + (shown - 1) * step), [0, 0.12, 0.3], [1.35, 1.1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ background: s.bg ?? "#FFF1C9" }}>
      <Dots />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 100px", gap: 60 }}>
        <div style={{ width: 520, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ transform: `scale(${shown ? numPop : 0.001})` }}>
            <PopText size={420} color={PALETTE.orange} stroke="#FFFFFF" strokeW={16}>
              {String(Math.max(shown, 1))}
            </PopText>
          </div>
          <PopText size={fit(s.word, 500, 96, { upper: true })} color="#1B1B1B" delay={6} style={{ textTransform: "uppercase" }}>
            {s.word}
          </PopText>
        </div>
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: `repeat(${perRow}, ${size * 1.3}px)`,
            justifyContent: "center",
            rowGap: 50,
          }}
        >
          {Array.from({ length: s.number }).map((_, i) => {
            const appear = s.startAt + i * step;
            const p = spring({ frame: frame - appear * fps, fps, config: { damping: 9, stiffness: 160 } });
            const hop = t > appear ? Math.abs(Math.sin((t - appear) * 5)) * -10 : 0;
            return (
              <div key={i} style={{ position: "relative", display: "flex", justifyContent: "center", transform: `scale(${p}) translateY(${hop}px)` }}>
                <Emo e={s.emoji} size={size} />
                <div
                  style={{
                    position: "absolute",
                    top: -18,
                    right: 4,
                    background: PALETTE.pink,
                    color: "#fff",
                    fontFamily: DISPLAY,
                    fontWeight: 700,
                    fontSize: size * 0.24,
                    width: size * 0.36,
                    height: size * 0.36,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "5px solid #fff",
                  }}
                >
                  {i + 1}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ───────────────────────────── color
const Splash: React.FC<{ color: string; size: number }> = ({ color, size }) => {
  const frame = useCurrentFrame();
  const p = usePop(0, 8);
  const pts = Array.from({ length: 14 }).map((_, i) => {
    const a = (i / 14) * Math.PI * 2;
    const r = 80 + (i % 2 ? 14 : 0) + Math.sin(frame / 10 + i) * 3;
    return `${100 + Math.cos(a) * r},${100 + Math.sin(a) * r}`;
  });
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ transform: `scale(${p}) rotate(${frame * 0.3}deg)`, overflow: "visible" }}>
      <polygon points={pts.join(" ")} fill={color} strokeLinejoin="round" stroke={color} strokeWidth="16" />
      {[[30, 30, 10], [175, 50, 8], [160, 175, 12], [20, 160, 7]].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={color} />
      ))}
    </svg>
  );
};

export const ColorScene: React.FC<{ s: S<"color"> }> = ({ s }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: s.bg ?? "#FFFDF6" }}>
      <Dots color={`${s.hex}22`} />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 110px", gap: 40 }}>
        <div style={{ position: "relative", width: 760, height: 760, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute" }}>
            <Splash color={s.hex} size={720} />
          </div>
          <PopText size={fit(s.name, 600, 200, { upper: true })} color="#FFFFFF" stroke="#1B1B1B" strokeW={12} delay={8} letterBounce style={{ textTransform: "uppercase" }}>
            {s.name}
          </PopText>
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "space-around", alignItems: "center" }}>
          {s.items.map((e, i) => {
            const p = spring({ frame: frame - 16 - i * 10, fps: 30, config: { damping: 9 } });
            return (
              <div key={i} style={{ transform: `scale(${p}) translateY(${Math.sin(frame / 8 + i * 2) * 14}px)` }}>
                <Emo e={e} size={s.items.length > 3 ? 190 : 230} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ───────────────────────────── letter (ABC / phonics)
const LETTER_COLORS = ["#E53935", "#FB8C00", "#43A047", "#1E88E5", "#8E24AA", "#F06292"];

export const LetterScene: React.FC<{ s: S<"letter"> }> = ({ s }) => {
  const frame = useCurrentFrame();
  const c = LETTER_COLORS[(s.letter.toUpperCase().charCodeAt(0) - 65 + 26) % LETTER_COLORS.length];
  const rest = s.word.slice(1);
  const pic = usePop(14, 9);
  return (
    <AbsoluteFill style={{ background: s.bg ?? "#E8F6FF" }}>
      <Dots />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 130px 120px", gap: 40 }}>
        <div style={{ width: 820, display: "flex", alignItems: "baseline", justifyContent: "center", gap: 30 }}>
          <PopText size={460} color={c} stroke="#FFFFFF" strokeW={18} delay={2}>
            {s.letter.toUpperCase()}
          </PopText>
          <PopText size={330} color={c} stroke="#FFFFFF" strokeW={14} delay={8}>
            {s.letter.toLowerCase()}
          </PopText>
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center", transform: `scale(${pic}) rotate(${Math.sin(frame / 12) * 5}deg)` }}>
          {s.image ? <Img src={staticFile(s.image)} style={{ width: 560, height: 560, objectFit: "contain" }} /> : <Emo e={s.emoji ?? "⭐"} size={420} />}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 70 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
          <PopText size={120} color="#1B1B1B" delay={24} style={{ textShadow: outline("#FFFFFF", 8) }}>
            <span style={{ color: c }}>{s.letter.toUpperCase()}</span> is for
          </PopText>
          <PopText size={fit(s.word, 900, 160)} color="#FFFFFF" stroke="#1B1B1B" strokeW={11} delay={32}>
            <span style={{ color: c }}>{s.word[0]}</span>
            {rest}
          </PopText>
          {s.sound ? (
            <PopText size={90} color={c} delay={40}>
              {s.sound}
            </PopText>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ───────────────────────────── action (movement / freeze-dance songs)
export const moveFor = (action: S<"action">["action"], t: number, beat: number, i: number) => {
  const ph = (t / beat) * Math.PI; // one half-cycle per beat
  switch (action) {
    case "jump":
      return `translateY(${-Math.abs(Math.sin(ph)) * 160}px) scaleY(${1 + Math.sin(ph * 2) * 0.03})`;
    case "stomp": {
      const down = Math.abs(Math.sin(ph));
      return `translateY(${-down * 40}px) rotate(${(i % 2 ? 1 : -1) * Math.sin(ph) * 6}deg) scale(${1 + (1 - down) * 0.05}, ${1 - (1 - down) * 0.05})`;
    }
    case "spin":
      return `scaleX(${Math.cos(ph / 2)}) translateY(${-Math.abs(Math.sin(ph)) * 30}px)`;
    case "wiggle":
    case "freeze":
      return `rotate(${Math.sin(ph) * 12}deg) translateX(${Math.sin(ph) * 30}px)`;
    case "clap":
      return `scale(${1 + Math.max(0, Math.cos(ph * 2)) * 0.08}) translateY(${-Math.max(0, Math.cos(ph * 2)) * 20}px)`;
    case "wave":
      return `rotate(${Math.sin(ph) * 8}deg)`;
  }
};

const ClapBurst: React.FC<{ t: number; beat: number }> = ({ t, beat }) => {
  const local = (t % beat) / beat;
  const o = interpolate(local, [0, 0.08, 0.4], [0, 1, 0], { extrapolateRight: "clamp" });
  return (
    <svg width="240" height="240" viewBox="0 0 100 100" style={{ position: "absolute", top: -60, left: "50%", marginLeft: -120, opacity: o, transform: `scale(${0.7 + local})` }}>
      {Array.from({ length: 8 }).map((_, k) => (
        <line key={k} x1="50" y1="50" x2="50" y2="12" stroke="#FFC93C" strokeWidth="7" strokeLinecap="round" transform={`rotate(${k * 45} 50 50)`} />
      ))}
    </svg>
  );
};

export const ActionScene: React.FC<{ s: S<"action"> }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const kids = s.characters.length ? s.characters : DEFAULT_KIDS;
  const freezeAt = s.action === "freeze" ? s.freezeAt ?? s.duration * 0.45 : Infinity;
  const frozen = t >= freezeAt;
  const flash = frozen ? interpolate(t - freezeAt, [0, 0.08, 0.5], [0, 0.85, 0], { extrapolateRight: "clamp" }) : 0;
  const word = frozen ? "FREEZE!" : s.word;
  const wordBeat = 1 + Math.max(0, Math.cos((t / s.beat) * Math.PI * 2)) * 0.06;
  const row = (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 70 }}>
      {kids.slice(0, 4).map((c, i) => {
        const tt = Math.min(t, freezeAt);
        return (
          <div key={i} style={{ position: "relative", transform: moveFor(s.action, tt + (s.action === "wave" ? i * 0.1 : 0), s.beat, i) }}>
            {s.action === "clap" ? <ClapBurst t={t} beat={s.beat} /> : null}
            <Kid c={c} size={500} phase={i * 0.3} />
          </div>
        );
      })}
    </div>
  );
  return (
    <AbsoluteFill style={{ background: frozen ? "#CFF3FF" : s.bg ?? "#FFE3F1" }}>
      {frozen ? null : <Doodles />}
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 50 }}>
        <div style={{ transform: `scale(${frozen ? 1.12 : wordBeat}) rotate(${frozen ? -3 : 0}deg)` }}>
          <PopText
            key={word}
            size={fit(word, 1500, 210, { upper: true })}
            color={frozen ? "#29B6F6" : PALETTE.pink}
            stroke="#FFFFFF"
            strokeW={14}
            letterBounce={!frozen}
            style={{ textTransform: "uppercase" }}
          >
            {word}
          </PopText>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 60 }}>
        {/* freeze: <Freeze> stops the kids' own idle animation too */}
        {frozen ? <Freeze frame={Math.round(freezeAt * fps)}>{row}</Freeze> : row}
      </AbsoluteFill>
      {flash ? <AbsoluteFill style={{ background: "#FFFFFF", opacity: flash }} /> : null}
    </AbsoluteFill>
  );
};
