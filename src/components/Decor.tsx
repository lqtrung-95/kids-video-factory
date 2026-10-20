import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export const PALETTE = {
  orange: "#F26B21",
  purple: "#9B4FCB",
  blue: "#2F86C9",
  green: "#4DB35E",
  yellow: "#F7C31B",
  pink: "#E8457A",
  sky: "#7EE0EA",
  cream: "#FFF6DC",
  brown: "#8A4B1C",
};

export const Cloud: React.FC<{ x: number; y: number; s?: number; speed?: number; color?: string }> = ({
  x,
  y,
  s = 1,
  speed = 0.4,
  color = "#FFFFFF",
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const dx = ((x + frame * speed + 400) % (width + 800)) - 400;
  return (
    <svg width={260 * s} height={120 * s} viewBox="0 0 260 120" style={{ position: "absolute", left: dx, top: y }}>
      <g fill={color}>
        <ellipse cx="130" cy="88" rx="120" ry="30" />
        <circle cx="80" cy="70" r="40" />
        <circle cx="140" cy="52" r="52" />
        <circle cx="196" cy="74" r="34" />
      </g>
    </svg>
  );
};

export const Sun: React.FC<{ x: number; y: number; r?: number }> = ({ x, y, r = 90 }) => {
  const frame = useCurrentFrame();
  return (
    <svg width={r * 3} height={r * 3} style={{ position: "absolute", left: x - r * 1.5, top: y - r * 1.5 }}>
      <g transform={`rotate(${frame * 0.4} ${r * 1.5} ${r * 1.5})`}>
        {Array.from({ length: 12 }).map((_, i) => (
          <rect
            key={i}
            x={r * 1.5 - 8}
            y={r * 0.12}
            width={16}
            height={r * 0.4}
            rx={8}
            fill="#FFC93C"
            transform={`rotate(${i * 30} ${r * 1.5} ${r * 1.5})`}
          />
        ))}
      </g>
      <circle cx={r * 1.5} cy={r * 1.5} r={r} fill="#FFD54A" />
    </svg>
  );
};

/** Hand-drawn style doodles (flowers, stars, blobs) for intro/outro cards. Original shapes. */
export const Doodles: React.FC<{ dark?: boolean }> = ({ dark }) => {
  const frame = useCurrentFrame();
  const items: { x: number; y: number; kind: string; c: string; s: number }[] = [
    { x: 70, y: 70, kind: "flower", c: "#F26B21", s: 1.1 },
    { x: 330, y: 60, kind: "blob", c: "#2F86C9", s: 0.8 },
    { x: 1500, y: 60, kind: "star", c: "#F7C31B", s: 1 },
    { x: 1700, y: 90, kind: "flower", c: "#FF8FB1", s: 1.3 },
    { x: 120, y: 520, kind: "star", c: "#4DB35E", s: 0.8 },
    { x: 60, y: 760, kind: "burst", c: "#1E6FD9", s: 1.4 },
    { x: 1640, y: 560, kind: "blob", c: "#9B4FCB", s: 1 },
    { x: 1500, y: 800, kind: "flower", c: "#E8457A", s: 0.9 },
    { x: 380, y: 860, kind: "tulip", c: "#F26B21", s: 1 },
    { x: 1380, y: 840, kind: "tulip", c: "#E63946", s: 1.1 },
    { x: 1150, y: 120, kind: "blob", c: "#F7C31B", s: 0.6 },
  ];
  return (
    <AbsoluteFill>
      {items.map((it, i) => {
        const wob = Math.sin(frame / 18 + i) * 6;
        return (
          <svg
            key={i}
            width={180 * it.s}
            height={180 * it.s}
            viewBox="0 0 180 180"
            style={{ position: "absolute", left: it.x, top: it.y + wob, transform: `rotate(${wob}deg)` }}
          >
            {it.kind === "flower" && (
              <g>
                {Array.from({ length: 6 }).map((_, k) => (
                  <ellipse key={k} cx="90" cy="45" rx="26" ry="40" fill={it.c} transform={`rotate(${k * 60} 90 90)`} />
                ))}
                <circle cx="90" cy="90" r="26" fill="#FFE07A" />
              </g>
            )}
            {it.kind === "star" && (
              <path d="M90 10 L112 66 L172 70 L126 108 L142 166 L90 134 L38 166 L54 108 L8 70 L68 66 Z" fill={it.c} />
            )}
            {it.kind === "blob" && <path d="M40 40 Q90 0 140 40 Q180 90 130 140 Q80 175 40 130 Q0 90 40 40 Z" fill={it.c} />}
            {it.kind === "burst" && (
              <g stroke={it.c} strokeWidth="18" strokeLinecap="round">
                {Array.from({ length: 6 }).map((_, k) => (
                  <line key={k} x1="90" y1="90" x2="90" y2="14" transform={`rotate(${k * 60 + 15} 90 90)`} />
                ))}
              </g>
            )}
            {it.kind === "tulip" && (
              <g>
                <rect x="86" y="90" width="8" height="80" fill="#3D9A4B" />
                <path d="M60 50 L75 70 L90 45 L105 70 L120 50 L118 95 Q90 115 62 95 Z" fill={it.c} />
                <ellipse cx="70" cy="140" rx="18" ry="8" fill="#3D9A4B" transform="rotate(-30 70 140)" />
              </g>
            )}
          </svg>
        );
      })}
      {dark ? null : null}
    </AbsoluteFill>
  );
};

export const Globe: React.FC<{ size: number; face?: boolean }> = ({ size, face = true }) => {
  const frame = useCurrentFrame();
  const spin = (frame * 1.2) % 400;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <defs>
        <clipPath id="globeClip">
          <circle cx="100" cy="100" r="92" />
        </clipPath>
      </defs>
      <circle cx="100" cy="100" r="96" fill="#2F86C9" />
      <g clipPath="url(#globeClip)" fill="#5CC46A">
        {[0, 400].map((o) => (
          <g key={o} transform={`translate(${o - spin} 0)`}>
            <path d="M20 40 Q60 20 80 50 Q70 90 40 80 Q10 70 20 40 Z" />
            <path d="M60 110 Q90 100 96 130 Q90 170 70 180 Q50 150 60 110 Z" />
            <path d="M130 30 Q190 30 200 70 Q170 100 140 80 Q120 60 130 30 Z" />
            <path d="M150 120 Q190 115 196 150 Q170 170 150 150 Z" />
            <path d="M230 50 Q270 30 300 60 Q290 100 250 96 Q220 80 230 50 Z" />
            <path d="M260 120 Q300 120 320 150 Q290 180 260 160 Z" />
            <path d="M340 30 Q380 40 390 70 Q360 90 340 70 Z" />
          </g>
        ))}
      </g>
      {face ? (
        <g>
          <circle cx="78" cy="96" r="8" fill="#1B1B1B" />
          <circle cx="122" cy="96" r="8" fill="#1B1B1B" />
          <circle cx="80" cy="93" r="2.5" fill="#fff" />
          <circle cx="124" cy="93" r="2.5" fill="#fff" />
          <path d="M84 120 Q100 136 116 120" stroke="#1B1B1B" strokeWidth="5" fill="none" strokeLinecap="round" />
          <ellipse cx="66" cy="114" rx="9" ry="5" fill="#FF8FA3" opacity="0.7" />
          <ellipse cx="134" cy="114" rx="9" ry="5" fill="#FF8FA3" opacity="0.7" />
        </g>
      ) : null}
    </svg>
  );
};

export const Heart: React.FC<{ size: number; color?: string }> = ({ size, color = "#F2546B" }) => (
  <svg width={size} height={size} viewBox="0 0 100 92">
    <path d="M50 88 C20 66 0 48 0 26 C0 10 12 0 26 0 C38 0 46 8 50 16 C54 8 62 0 74 0 C88 0 100 10 100 26 C100 48 80 66 50 88 Z" fill={color} />
  </svg>
);

/** Scene backgrounds — used as the fallback when no AI/stock image is supplied. */
export const Background: React.FC<{ kind: string; color?: string; src?: string }> = ({ kind, color, src }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  if (kind === "image" && src) {
    const zoom = 1 + frame * 0.0006; // Ken Burns
    return (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})` }} />
      </AbsoluteFill>
    );
  }
  if (kind === "video" && src) {
    return (
      <AbsoluteFill>
        <OffthreadVideo src={staticFile(src)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
    );
  }
  if (kind === "blocks") {
    const c = [PALETTE.orange, PALETTE.yellow, PALETTE.blue, PALETTE.purple, PALETTE.pink, PALETTE.green];
    return (
      <AbsoluteFill style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr" }}>
        {c.map((x) => (
          <div key={x} style={{ background: x }} />
        ))}
      </AbsoluteFill>
    );
  }
  if (kind === "sea") {
    return (
      <AbsoluteFill style={{ background: "linear-gradient(#BFE6F7, #E9F7FC 55%)" }}>
        <Cloud x={200} y={80} s={1} />
        <Cloud x={1200} y={140} s={0.8} speed={0.3} />
        <svg width={width} height={height * 0.5} style={{ position: "absolute", bottom: 0 }} viewBox="0 0 1920 540" preserveAspectRatio="none">
          {[0, 1, 2].map((k) => (
            <path
              key={k}
              d={`M0 ${120 + k * 120} ${Array.from({ length: 9 })
                .map((_, i) => `Q ${i * 240 + 120} ${80 + k * 120 + Math.sin(frame / 15 + i + k) * 30} ${(i + 1) * 240} ${120 + k * 120}`)
                .join(" ")} L1920 540 L0 540 Z`}
              fill={["#4FA9E0", "#2F86C9", "#1D63A8"][k]}
            />
          ))}
        </svg>
      </AbsoluteFill>
    );
  }
  if (kind === "desert") {
    return (
      <AbsoluteFill style={{ background: "linear-gradient(#F6C9A0, #FBE3C8 60%)" }}>
        <Sun x={1500} y={220} r={80} />
        <svg width={width} height={height} viewBox="0 0 1920 1080" style={{ position: "absolute" }} preserveAspectRatio="none">
          <path d="M0 760 Q480 640 960 760 T1920 740 L1920 1080 L0 1080 Z" fill="#E7A86A" />
          <path d="M0 880 Q600 780 1200 880 T1920 860 L1920 1080 L0 1080 Z" fill="#D88C4F" />
          {[180, 1650].map((x) => (
            <g key={x} fill="#4E9A51">
              <rect x={x} y={560} width={60} height={320} rx={30} />
              <rect x={x - 70} y={640} width={50} height={140} rx={25} />
              <rect x={x - 70} y={740} width={110} height={40} rx={20} />
              <rect x={x + 80} y={600} width={50} height={140} rx={25} />
              <rect x={x + 30} y={700} width={100} height={40} rx={20} />
            </g>
          ))}
        </svg>
      </AbsoluteFill>
    );
  }
  if (kind === "meadow") {
    return (
      <AbsoluteFill style={{ background: "linear-gradient(#CDEFF5, #F2FBF5 60%)" }}>
        <Cloud x={120} y={90} />
        <Cloud x={1100} y={60} s={1.2} speed={0.25} />
        <svg width={width} height={height} viewBox="0 0 1920 1080" style={{ position: "absolute" }} preserveAspectRatio="none">
          <path d="M0 720 Q500 600 1000 700 T1920 680 L1920 1080 L0 1080 Z" fill="#9BD67A" />
          <path d="M0 840 Q700 760 1300 850 T1920 830 L1920 1080 L0 1080 Z" fill="#78C05A" />
        </svg>
      </AbsoluteFill>
    );
  }
  if (kind === "color") return <AbsoluteFill style={{ background: color ?? PALETTE.cream }} />;
  // sky (default) + globe variant
  return (
    <AbsoluteFill style={{ background: color ?? "linear-gradient(#7EE0EA, #BDF1F4)" }}>
      <Cloud x={-100} y={60} s={1.1} />
      <Cloud x={700} y={30} s={0.7} speed={0.25} />
      <Cloud x={1400} y={110} s={0.9} speed={0.35} />
      <Cloud x={300} y={height - 170} s={1.6} speed={0.15} />
      <Cloud x={1300} y={height - 150} s={1.8} speed={0.2} />
    </AbsoluteFill>
  );
};
