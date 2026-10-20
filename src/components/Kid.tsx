import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import type { Character, KidLook } from "../schema";

/**
 * Built-in vector "chibi" kid (original design, flat style: big head, closed happy eyes,
 * blush). Used when no AI-generated character image is supplied, so a video can always
 * render. Swap to `image` for illustrated characters generated with a reference sheet.
 */
const DEFAULT: KidLook = {
  skin: "#F8D5B8",
  hair: "#3B2417",
  hairStyle: "short",
  outfit: "shirtPants",
  top: "#E63946",
  bottom: "#1D3557",
  accent: "#FFFFFF",
  hat: "none",
};

const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  const r = c((n >> 16) & 255), g = c((n >> 8) & 255), b = c(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
};

const BackHair: React.FC<{ l: KidLook }> = ({ l }) => {
  switch (l.hairStyle) {
    case "long":
      return <path d="M34 92 Q30 170 46 214 L154 214 Q170 170 166 92 Z" fill={l.hair} />;
    case "bob":
      return <path d="M32 92 Q30 140 44 150 L156 150 Q170 140 168 92 Z" fill={l.hair} />;
    case "bun":
      return <circle cx="100" cy="26" r="24" fill={l.hair} />;
    case "pigtails":
      return (
        <g fill={l.hair}>
          <ellipse cx="30" cy="128" rx="17" ry="30" />
          <ellipse cx="170" cy="128" rx="17" ry="30" />
          <circle cx="36" cy="100" r="7" fill={l.accent} />
          <circle cx="164" cy="100" r="7" fill={l.accent} />
        </g>
      );
    default:
      return null;
  }
};

const FrontHair: React.FC<{ l: KidLook }> = ({ l }) => {
  const parted = l.hairStyle !== "short";
  return parted ? (
    <path
      d="M36 98 Q34 30 100 28 Q166 30 164 98 Q156 66 128 56 Q112 72 100 58 Q88 72 72 56 Q44 66 36 98 Z"
      fill={l.hair}
    />
  ) : (
    <path d="M36 96 Q36 26 100 26 Q164 26 164 96 Q154 62 120 58 Q104 70 84 58 Q48 62 36 96 Z" fill={l.hair} />
  );
};

const Hat: React.FC<{ l: KidLook }> = ({ l }) => {
  const c = l.hatColor ?? l.accent;
  switch (l.hat) {
    case "conical": // nón lá
      return (
        <g>
          <path d="M8 66 L100 -8 L192 66 Q100 84 8 66 Z" fill={c} stroke={shade(c, -0.18)} strokeWidth="3" />
          {[40, 70, 100, 130, 160].map((x) => (
            <line key={x} x1="100" y1="-6" x2={x} y2="70" stroke={shade(c, -0.12)} strokeWidth="2" />
          ))}
        </g>
      );
    case "beret":
      return (
        <g fill={c}>
          <ellipse cx="94" cy="36" rx="64" ry="22" />
          <rect x="94" y="6" width="6" height="12" rx="3" />
        </g>
      );
    case "sombrero":
      return (
        <g>
          <ellipse cx="100" cy="52" rx="104" ry="18" fill={c} />
          <path d="M58 52 Q62 -6 100 -6 Q138 -6 142 52 Z" fill={c} />
          <rect x="60" y="34" width="80" height="10" fill={l.top} />
        </g>
      );
    case "flowerCrown":
      return (
        <g>
          {[
            [44, 52, "#E63946"], [66, 36, "#FFB703"], [88, 28, "#FB5607"],
            [112, 28, "#E63946"], [134, 36, "#8338EC"], [156, 52, "#FFB703"],
          ].map(([x, y, col]) => (
            <g key={`${x}`}>
              <circle cx={x as number} cy={y as number} r="14" fill={col as string} />
              <circle cx={x as number} cy={y as number} r="5" fill="#FFF3B0" />
            </g>
          ))}
        </g>
      );
    case "kokoshnik":
      return (
        <g>
          <path d="M34 74 Q30 -16 100 -16 Q170 -16 166 74 Q100 54 34 74 Z" fill={c} />
          {[56, 78, 100, 122, 144].map((x) => (
            <circle key={x} cx={x} cy={28} r="6" fill="#FFD166" />
          ))}
        </g>
      );
    case "bow":
      return (
        <g fill={c}>
          <path d="M132 36 L160 18 L160 54 Z" />
          <path d="M132 36 L104 18 L104 54 Z" />
          <circle cx="132" cy="36" r="8" fill={shade(c, -0.15)} />
        </g>
      );
    case "headscarf":
      return <path d="M28 104 Q24 18 100 18 Q176 18 172 104 Q170 60 100 54 Q30 60 28 104 Z" fill={c} />;
    default:
      return null;
  }
};

const Body: React.FC<{ l: KidLook }> = ({ l }) => {
  const shoes = "#2B2B2B";
  if (l.outfit === "dress") {
    return (
      <g>
        <rect x="82" y="290" width="12" height="26" fill={l.skin} />
        <rect x="106" y="290" width="12" height="26" fill={l.skin} />
        <ellipse cx="86" cy="318" rx="13" ry="7" fill={shoes} />
        <ellipse cx="114" cy="318" rx="13" ry="7" fill={shoes} />
        <path d="M74 150 L126 150 L154 298 Q100 308 46 298 Z" fill={l.top} />
        <path d="M84 196 L116 196 L124 290 L76 290 Z" fill={l.accent} opacity="0.92" />
        <rect x="74" y="190" width="52" height="9" rx="4" fill={l.bottom} />
      </g>
    );
  }
  if (l.outfit === "tunic") {
    // áo dài / long tunic over trousers
    return (
      <g>
        <path d="M78 230 L122 230 L128 314 L104 314 L100 250 L96 314 L72 314 Z" fill={l.bottom} />
        <ellipse cx="84" cy="318" rx="13" ry="7" fill={shoes} />
        <ellipse cx="116" cy="318" rx="13" ry="7" fill={shoes} />
        <path d="M72 150 L128 150 L134 300 L104 300 L100 236 L96 300 L66 300 Z" fill={l.top} />
        <path d="M92 150 L108 150 L100 166 Z" fill={l.accent} />
        <circle cx="114" cy="176" r="3.5" fill={l.accent} />
        <circle cx="118" cy="194" r="3.5" fill={l.accent} />
      </g>
    );
  }
  return (
    <g>
      <rect x="74" y="222" width="24" height="86" rx="6" fill={l.bottom} />
      <rect x="102" y="222" width="24" height="86" rx="6" fill={l.bottom} />
      <ellipse cx="84" cy="312" rx="15" ry="8" fill={shoes} />
      <ellipse cx="116" cy="312" rx="15" ry="8" fill={shoes} />
      <rect x="70" y="148" width="60" height="84" rx="14" fill={l.top} />
      <path d="M90 148 L110 148 L100 166 Z" fill={l.accent} />
      <rect x="70" y="216" width="60" height="10" fill={shade(l.bottom, -0.1)} />
    </g>
  );
};

export const VectorKid: React.FC<{ look?: Partial<KidLook>; size: number; phase?: number; mirror?: boolean }> = ({
  look,
  size,
  phase = 0,
  mirror = false,
}) => {
  const frame = useCurrentFrame();
  const l = { ...DEFAULT, ...look } as KidLook;
  const t = frame / 30 + phase;
  const bob = Math.sin(t * Math.PI * 2 * 0.9) * 4;
  const wave = Math.sin(t * Math.PI * 2 * 1.1) * 10;
  const sleeve = l.outfit === "dress" || l.outfit === "tunic" ? l.top : l.top;
  return (
    <svg
      viewBox="-20 -24 240 360"
      width={size * (240 / 360)}
      height={size}
      style={{ overflow: "visible", transform: mirror ? "scaleX(-1)" : undefined }}
    >
      <g transform={`translate(0 ${bob})`}>
        <ellipse cx="100" cy="324" rx="58" ry="8" fill="rgba(0,0,0,0.12)" transform={`translate(0 ${-bob})`} />
        <BackHair l={l} />
        <Body l={l} />
        {/* left arm */}
        <path d="M74 160 Q58 192 58 222" stroke={sleeve} strokeWidth="18" strokeLinecap="round" fill="none" />
        <circle cx="58" cy="226" r="10" fill={l.skin} />
        {/* right arm + flag, waving */}
        <g transform={`rotate(${wave} 126 160)`}>
          <path d="M126 160 Q148 176 156 198" stroke={sleeve} strokeWidth="18" strokeLinecap="round" fill="none" />
          {l.flag ? (
            <g>
              <line x1="158" y1="210" x2="164" y2="112" stroke="#6B4F2A" strokeWidth="4" strokeLinecap="round" />
              <g transform={`skewY(${Math.sin(t * 6) * 4})`}>
                <image href={staticFile(`flags/${l.flag}.svg`)} x="165" y="112" width="48" height="36" preserveAspectRatio="none" />
              </g>
            </g>
          ) : null}
          <circle cx="158" cy="204" r="10" fill={l.skin} />
        </g>
        {/* head */}
        <rect x="90" y="138" width="20" height="16" fill={l.skin} />
        <circle cx="100" cy="94" r="64" fill={l.skin} />
        <ellipse cx="38" cy="100" rx="9" ry="13" fill={l.skin} />
        <ellipse cx="162" cy="100" rx="9" ry="13" fill={l.skin} />
        {/* face: closed happy eyes, blush, smile */}
        <path d="M68 102 Q78 92 88 102" stroke="#3A2A20" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M112 102 Q122 92 132 102" stroke="#3A2A20" strokeWidth="5" strokeLinecap="round" fill="none" />
        <ellipse cx="66" cy="118" rx="11" ry="7" fill="#FF8FA3" opacity="0.55" />
        <ellipse cx="134" cy="118" rx="11" ry="7" fill="#FF8FA3" opacity="0.55" />
        <path d="M90 120 Q100 132 110 120" stroke="#A33A3A" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        {l.hat === "headscarf" || l.hat === "kokoshnik" ? null : <FrontHair l={l} />}
        <Hat l={l} />
      </g>
    </svg>
  );
};

/** Renders an AI image if provided, otherwise the vector kid. */
export const Kid: React.FC<{ c: Character; size: number; phase?: number; mirror?: boolean }> = ({
  c,
  size,
  phase = 0,
  mirror,
}) => {
  const frame = useCurrentFrame();
  if (c.image) {
    const bob = Math.sin((frame / 30 + phase) * Math.PI * 1.8) * 6;
    return (
      <Img
        src={staticFile(c.image)}
        style={{ height: size, transform: `translateY(${bob}px) ${mirror ? "scaleX(-1)" : ""}` }}
      />
    );
  }
  return <VectorKid look={c.look} size={size} phase={phase} mirror={mirror} />;
};
