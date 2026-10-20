import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Background, Doodles, Globe, Heart, PALETTE } from "../components/Decor";
import { Kid } from "../components/Kid";
import { Karaoke, PopText, fit, outline, usePop } from "../components/Text";
import { DISPLAY } from "../fonts";
import type { Character, Scene } from "../schema";
import { ActionScene, ColorScene, CountScene, LetterScene, moveFor } from "./LearnScenes";
import { ConfettiBurst, Particles, beatPulse, fxFor } from "../components/Motion";

const EMOJI_FONT = `"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;

type S<T extends Scene["type"]> = Extract<Scene, { type: T }>;

/** Slide-up entrance for characters. */
const Enter: React.FC<{ delay?: number; children: React.ReactNode; from?: "bottom" | "left" | "right" }> = ({
  delay = 0,
  children,
  from = "bottom",
}) => {
  const p = usePop(delay, 13);
  const d = (1 - p) * 500;
  const tr = from === "bottom" ? `translateY(${d}px)` : from === "left" ? `translateX(${-d}px)` : `translateX(${d}px)`;
  return <div style={{ transform: tr }}>{children}</div>;
};

const FlagCard: React.FC<{ code: string; w: number }> = ({ code, w }) => {
  const frame = useCurrentFrame();
  const p = usePop(4);
  return (
    <div
      style={{
        width: w,
        height: w * 0.75,
        borderRadius: w * 0.06,
        overflow: "hidden",
        boxShadow: `0 ${w * 0.04}px 0 rgba(0,0,0,0.18)`,
        border: `${w * 0.035}px solid white`,
        transform: `scale(${p}) rotate(${Math.sin(frame / 14) * 3}deg) skewY(${Math.sin(frame / 9) * 2}deg)`,
      }}
    >
      <Img src={staticFile(`flags/${code}.svg`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
};

// ───────────────────────────── intro
export const IntroScene: React.FC<{ s: S<"intro"> }> = ({ s }) => (
  <AbsoluteFill style={{ background: PALETTE.cream }}>
    <Doodles />
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20 }}>
      <PopText size={fit(s.title, 1500, 190)} color={PALETTE.brown} letterBounce delay={3}>
        {s.title}
      </PopText>
      <PopText size={56} color={PALETTE.orange} delay={14} style={{ letterSpacing: 8 }}>
        {s.subtitle}
      </PopText>
    </AbsoluteFill>
    {s.handle ? (
      <div style={{ position: "absolute", left: 60, bottom: 40, fontFamily: DISPLAY, fontWeight: 600, fontSize: 34, color: PALETTE.brown }}>
        {s.handle}
      </div>
    ) : null}
  </AbsoluteFill>
);

// ───────────────────────────── lyric (song part)
/** Default dance during the song: sway + small bounce on the beat (kids alternate direction). */
const groove = (t: number, beat: number, i: number) => {
  const ph = (t / beat) * Math.PI;
  const side = i % 2 ? 1 : -1;
  return `rotate(${Math.sin(ph) * 5 * side}deg) translateY(${-Math.abs(Math.sin(ph)) * 14}px)`;
};

const KidRow: React.FC<{
  chars: Character[];
  size: number;
  gap?: number;
  emojis?: string[];
  action?: S<"lyric">["action"];
  beat?: number;
}> = ({ chars, size, gap = 10, emojis = [], action, beat = 0.545 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap }}>
      {chars.map((c, i) => (
        <Enter key={i} delay={4 + i * 4}>
          <div style={{ transform: action ? moveFor(action, frame / fps, beat, i) : groove(frame / fps, beat, i) }}>
            <Kid c={c} size={size} phase={i * 0.37} />
          </div>
        </Enter>
      ))}
      {emojis.map((e, i) => (
        <Enter key={`e${i}`} delay={8 + i * 4}>
          <div
            style={{
              fontFamily: `"Noto Color Emoji", "Apple Color Emoji", sans-serif`,
              fontSize: size * 0.5,
              lineHeight: 1,
              transform: `translateY(${Math.abs(Math.sin(frame / 7 + i)) * -size * 0.08}px)`,
            }}
          >
            {e}
          </div>
        </Enter>
      ))}
    </div>
  );
};

const GlobeRing: React.FC<{ chars: Character[] }> = ({ chars }) => {
  const frame = useCurrentFrame();
  const R = 330;
  const n = Math.max(chars.length, 1);
  return (
    <div style={{ position: "relative", width: 900, height: 900 }}>
      <div style={{ position: "absolute", left: 450 - 230, top: 450 - 230 }}>
        <Globe size={460} />
      </div>
      {chars.map((c, i) => {
        const a = (i / n) * Math.PI * 2 + frame * 0.006;
        const x = 450 + Math.cos(a) * R;
        const y = 450 + Math.sin(a) * R;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - 70,
              top: y - 105,
              transform: `rotate(${(a * 180) / Math.PI + 90}deg)`,
            }}
          >
            <Kid c={c} size={210} phase={i * 0.3} />
          </div>
        );
      })}
    </div>
  );
};

export const LyricScene: React.FC<{ s: S<"lyric"> }> = ({ s }) => {
  const isGlobe = s.background.kind === "globe";
  const bgKind = isGlobe ? "sky" : s.background.kind;
  const lyric = (
    <Karaoke
      lines={s.lines}
      duration={s.duration}
      mode={s.textStyle}
      align={s.textPosition === "left" ? "left" : "center"}
      size={s.textPosition === "left" ? 96 : 86}
    />
  );
  const chorus = s.textStyle === "box";
  const fx = s.fx && s.fx !== "auto" ? s.fx : fxFor(s.background.kind, chorus);
  return (
    <AbsoluteFill>
      <Background kind={bgKind} color={s.background.color} src={s.background.src} />
      <Particles kind={fx} seed={s.lines[0]?.text.length ?? 1} count={chorus ? 30 : 20} />
      {chorus ? <ConfettiBurst at={6} /> : null}
      {isGlobe ? (
        <AbsoluteFill style={{ alignItems: "flex-end", justifyContent: "center", paddingRight: 120 }}>
          <div style={{ transform: "scale(1.05)" }}>
            <GlobeRing chars={s.characters} />
          </div>
        </AbsoluteFill>
      ) : s.textPosition === "left" ? (
        <AbsoluteFill style={{ alignItems: "flex-end", justifyContent: "flex-end", padding: "0 100px 110px 0" }}>
          <KidRow chars={s.characters} size={520} emojis={s.emojis} action={s.action} beat={s.beat} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: s.textPosition === "top" ? "flex-end" : "center",
            paddingBottom: s.textPosition === "top" ? 70 : 180,
          }}
        >
          <KidRow chars={s.characters} size={s.textPosition === "top" ? 600 : 520} gap={40} emojis={s.emojis} action={s.action} beat={s.beat} />
        </AbsoluteFill>
      )}
      <AbsoluteFill
        style={{
          padding: "60px 90px",
          justifyContent: s.textPosition === "bottom" ? "flex-end" : s.textPosition === "top" ? "flex-start" : "center",
          alignItems: s.textPosition === "left" ? "flex-start" : "center",
          width: s.textPosition === "left" || isGlobe ? "52%" : "100%",
        }}
      >
        <BeatPulse beat={s.beat}>{lyric}</BeatPulse>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** The lyric block breathes with the music (≈3 % on every beat). */
const BeatPulse: React.FC<{ beat: number; children: React.ReactNode }> = ({ beat, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <div style={{ transform: `scale(${beatPulse(frame, fps, beat, 0.03)})` }}>{children}</div>;
};

// ───────────────────────────── title card
/** Long headlines break into two balanced lines instead of shrinking. */
const splitTwo = (t: string) => {
  if (t.length <= 18) return [t];
  const words = t.split(" ");
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (d < bestDiff) (bestDiff = d), (best = i);
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
};

export const TitleScene: React.FC<{ s: S<"title"> }> = ({ s }) => {
  const big = splitTwo(s.big);
  const bigSize = Math.min(...big.map((l) => fit(l, 1750, 170, { upper: true })));
  return (
    <AbsoluteFill>
      <Background kind="sky" />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 6 }}>
        {s.small.map((t, i) => (
          <PopText key={i} size={fit(t, 1700, 96, { upper: true })} color="#F0631F" delay={i * 6} letterBounce style={{ textTransform: "uppercase" }}>
            {t}
          </PopText>
        ))}
        {big.map((l, i) => (
          <PopText key={`b${i}`} size={bigSize} color="#E8336D" stroke="#FFFFFF" strokeW={10} delay={s.small.length * 6 + 4 + i * 5} letterBounce style={{ textTransform: "uppercase" }}>
            {l}
          </PopText>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Animal/object on a country card, hopping in time with its sound. */
const Pet: React.FC<{ pet: NonNullable<S<"country">["pet"]>; size: number }> = ({ pet, size }) => {
  const frame = useCurrentFrame();
  const p = usePop(20, 9);
  const hop = Math.abs(Math.sin(frame / 7)) * -size * 0.08;
  return (
    <div style={{ transform: `scale(${p}) translateY(${hop}px)`, filter: "drop-shadow(0 10px 0 rgba(0,0,0,0.12))" }}>
      {pet.image ? (
        <Img src={staticFile(pet.image)} style={{ width: size, height: size, objectFit: "contain" }} />
      ) : (
        <div style={{ fontFamily: EMOJI_FONT, fontSize: size * 0.85, lineHeight: 1 }}>{pet.emoji}</div>
      )}
    </div>
  );
};

// ───────────────────────────── country card
const GreetingBlock: React.FC<{ s: S<"country">; align: "center" | "left"; scale?: number; maxW: number }> = ({ s, align, scale = 1, maxW }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : "flex-start", gap: 12 * scale }}>
    <PopText size={fit(s.country, maxW, 84 * scale, { upper: true })} color="#1B1B1B" delay={6} style={{ textTransform: "uppercase", letterSpacing: 2 }}>
      {s.country}
    </PopText>
    {s.native ? (
      <PopText size={fit(s.native, maxW * 0.62, 130 * scale)} color="#1B1B1B" stroke="#FFFFFF" strokeW={7 * scale} delay={18}>
        {s.native}
      </PopText>
    ) : null}
    <PopText size={fit(s.romanization ?? s.greeting, maxW, (s.native ? 104 : 180) * scale)} color="#FFFFFF" stroke="#1B1B1B" strokeW={10 * scale} delay={s.native ? 28 : 16} letterBounce>
      {s.romanization ?? s.greeting}
    </PopText>
  </div>
);

export const CountryScene: React.FC<{ s: S<"country"> }> = ({ s }) => {
  const frame = useCurrentFrame();
  const kids: Character[] = s.characters.length ? s.characters : [{ look: { flag: s.flag } as Character["look"] }];
  if (s.layout === "quad") {
    const cells = [PALETTE.orange, PALETTE.yellow, PALETTE.blue, PALETTE.purple, PALETTE.yellow, PALETTE.green];
    return (
      <AbsoluteFill>
        <AbsoluteFill style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr 1fr", gridTemplateRows: "1fr 1fr" }}>
          {cells.map((c, i) => (
            <div key={i} style={{ background: c }} />
          ))}
        </AbsoluteFill>
        <AbsoluteFill style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", padding: "0 70px 50px" }}>
          <Enter delay={2} from="left">
            <Kid c={kids[0]} size={640} />
          </Enter>
          <Enter delay={6} from="right">
            <Kid c={kids[1] ?? kids[0]} size={640} phase={0.5} />
          </Enter>
        </AbsoluteFill>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: s.pet ? 22 : 40 }}>
          <FlagCard code={s.flag} w={s.pet ? 280 : 360} />
          <GreetingBlock s={s} align="center" scale={0.9} maxW={640} />
          {s.pet ? <Pet pet={s.pet} size={250} /> : null}
        </AbsoluteFill>
        {s.props.map((p, i) => (
          <Enter key={i} delay={10 + i * 4}>
            <Img src={staticFile(p.image)} style={{ position: "absolute", left: p.x, top: p.y, width: p.size }} />
          </Enter>
        ))}
      </AbsoluteFill>
    );
  }
  // poster
  return (
    <AbsoluteFill style={{ background: s.bg ?? "#BFE3C0" }}>
      <svg width="1920" height="1080" style={{ position: "absolute" }}>
        <circle cx={1650} cy={880} r={420} fill="rgba(255,255,255,0.28)" />
        <circle cx={260} cy={180} r={260} fill="rgba(255,255,255,0.22)" />
        <circle cx={1050} cy={120} r={120} fill="rgba(255,255,255,0.18)" />
      </svg>
      <div
        style={{
          position: "absolute",
          right: -60,
          top: 40,
          transform: `rotate(${8 + Math.sin(frame / 12) * 3}deg)`,
        }}
      >
        <FlagCard code={s.flag} w={330} />
      </div>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "flex-end", padding: "0 0 60px 80px", gap: 0 }}>
        {kids.slice(0, 2).map((c, i) => (
          <Enter key={i} delay={2 + i * 5}>
            <Kid c={c} size={kids.length > 1 ? 600 : 720} phase={i * 0.45} />
          </Enter>
        ))}
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "flex-start", justifyContent: "center", paddingLeft: kids.length > 1 ? 920 : 760 }}>
        <GreetingBlock s={s} align="left" maxW={kids.length > 1 ? 900 : 1050} />
      </AbsoluteFill>
      {s.pet ? (
        <div style={{ position: "absolute", right: 120, bottom: 70 }}>
          <Pet pet={s.pet} size={330} />
        </div>
      ) : null}
      {s.props.map((p, i) => (
        <Enter key={i} delay={10 + i * 4}>
          <Img src={staticFile(p.image)} style={{ position: "absolute", left: p.x, top: p.y, width: p.size }} />
        </Enter>
      ))}
    </AbsoluteFill>
  );
};

// ───────────────────────────── vocab card (+ "guess who" silhouette reveal)

const Picture: React.FC<{ s: S<"vocab">; size: number }> = ({ s, size }) =>
  s.image ? (
    <Img src={staticFile(s.image)} style={{ maxWidth: size, maxHeight: size, objectFit: "contain" }} />
  ) : s.emoji ? (
    <div style={{ fontFamily: EMOJI_FONT, fontSize: size * 0.72, lineHeight: 1 }}>{s.emoji}</div>
  ) : (
    <div
      style={{
        width: size * 0.7,
        height: size * 0.7,
        borderRadius: "50%",
        background: PALETTE.orange,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: DISPLAY,
        fontWeight: 700,
        fontSize: size * 0.4,
        color: "#fff",
      }}
    >
      {[...s.word][0]}
    </div>
  );

const Burst: React.FC<{ size: number; color: string }> = ({ size, color }) => {
  const frame = useCurrentFrame();
  const p = usePop(0, 9);
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ position: "absolute", transform: `scale(${p}) rotate(${frame * 0.6}deg)` }}>
      <path
        d={Array.from({ length: 24 })
          .map((_, i) => {
            const r = i % 2 ? 62 : 98;
            const a = (i / 24) * Math.PI * 2;
            return `${i ? "L" : "M"}${100 + Math.cos(a) * r} ${100 + Math.sin(a) * r}`;
          })
          .join(" ") + "Z"}
        fill={color}
      />
    </svg>
  );
};

/** text column next to the 900px picture: 1920 − 2×110 padding − 900 − 60 gap */
const VOCAB_TEXT_W = 740;

export const VocabScene: React.FC<{ s: S<"vocab"> }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = usePop(3, 10);
  const imgLeft = s.side === "left";
  const revealF = s.guess ? Math.round(s.reveal * fps) : 0;
  const hidden = s.guess && frame < revealF;
  const float = Math.sin(frame / 16) * 10;
  const shake = hidden ? Math.sin(frame / 2.2) * 4 : 0;
  const pop = s.guess ? interpolate(frame, [revealF, revealF + 5, revealF + 12], [1, 1.18, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  return (
    <AbsoluteFill style={{ background: s.bg ?? "#FFE7B3" }}>
      {s.background ? <Background kind={s.background.kind} color={s.background.color} src={s.background.src} /> : null}
      <AbsoluteFill style={{ flexDirection: imgLeft ? "row" : "row-reverse", alignItems: "center", padding: "0 110px", gap: 60 }}>
        <div style={{ width: 900, height: 900, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {s.guess && !hidden ? (
            <Sequence from={revealF} layout="none">
              <Burst size={900} color="rgba(255,255,255,0.75)" />
            </Sequence>
          ) : null}
          <div
            style={{
              transform: `scale(${p * pop}) translateY(${float}px) rotate(${shake}deg)`,
              filter: hidden ? "brightness(0)" : undefined,
              opacity: hidden ? 0.82 : 1,
            }}
          >
            <Picture s={s} size={820} />
          </div>
          {hidden ? (
            <div style={{ position: "absolute", right: 40, top: 60, transform: `scale(${1 + Math.sin(frame / 5) * 0.08})` }}>
              <PopText size={220} color={PALETTE.yellow} stroke="#1B1B1B" strokeW={10} delay={8}>
                ?
              </PopText>
            </div>
          ) : null}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          {hidden ? (
            <>
              <PopText size={90} color="#1B1B1B" delay={6}>
                Who says
              </PopText>
              <div style={{ transform: `rotate(${Math.sin(frame / 3) * 4}deg)` }}>
                <PopText size={fit(s.guess ?? "", VOCAB_TEXT_W, 190)} color="#FFFFFF" stroke={PALETTE.pink} strokeW={12} delay={14} letterBounce>
                  {s.guess ?? ""}
                </PopText>
              </div>
            </>
          ) : (
            <Sequence from={revealF} layout="none">
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
                <PopText size={fit(s.word, VOCAB_TEXT_W, 170)} color="#FFFFFF" stroke="#1B1B1B" strokeW={11} delay={s.guess ? 2 : 10} letterBounce>
                  {s.word}
                </PopText>
                {s.sub ? (
                  <PopText size={fit(s.sub, VOCAB_TEXT_W, 70)} color="#1B1B1B" delay={s.guess ? 10 : 18}>
                    {s.sub}
                  </PopText>
                ) : null}
              </div>
            </Sequence>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ───────────────────────────── outro
export const OutroScene: React.FC<{ s: S<"outro"> }> = ({ s }) => {
  const frame = useCurrentFrame();
  const beat = 1 + Math.sin(frame / 7) * 0.04;
  return (
    <AbsoluteFill>
      <Background kind="sky" />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 50 }}>
        <PopText size={120} color="#E8336D" stroke="#FFFFFF" strokeW={9} letterBounce>
          {s.text}
        </PopText>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 40 }}>
        <div style={{ position: "relative", width: 900, height: 820, display: "flex", justifyContent: "center" }}>
          <div style={{ position: "absolute", top: 0, transform: `scale(${beat})` }}>
            <Heart size={820} />
          </div>
          <div style={{ position: "absolute", bottom: 60 }}>
            <KidRow chars={s.characters} size={420} gap={0} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ───────────────────────────── subscribe end card
export const SubscribeScene: React.FC<{ s: S<"subscribe"> }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pulse = 1 + Math.max(0, Math.sin((frame / fps) * Math.PI * 2)) * 0.05;
  const click = interpolate(frame, [fps * 1.6, fps * 1.75, fps * 1.9], [1, 0.9, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#141414" }}>
      <Doodles dark />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 34 }}>
        <div style={{ transform: `scale(${pulse * click})` }}>
          <PopText
            size={130}
            color="#FFFFFF"
            style={{ background: "#E62117", padding: "10px 60px 20px", borderRadius: 28, letterSpacing: 4, textShadow: outline("#B5160F", 3) }}
          >
            {s.text}
          </PopText>
        </div>
        <PopText size={54} color="#141414" delay={10} style={{ background: PALETTE.yellow, padding: "6px 36px 12px", borderRadius: 999 }}>
          {s.sub}
        </PopText>
        {s.handle ? (
          <PopText size={40} color="#FFFFFF" delay={18}>
            {s.handle}
          </PopText>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const SceneView: React.FC<{ s: Scene }> = ({ s }) => {
  switch (s.type) {
    case "intro":
      return <IntroScene s={s} />;
    case "lyric":
      return <LyricScene s={s} />;
    case "title":
      return <TitleScene s={s} />;
    case "country":
      return <CountryScene s={s} />;
    case "vocab":
      return <VocabScene s={s} />;
    case "count":
      return <CountScene s={s} />;
    case "color":
      return <ColorScene s={s} />;
    case "letter":
      return <LetterScene s={s} />;
    case "action":
      return <ActionScene s={s} />;
    case "outro":
      return <OutroScene s={s} />;
    case "subscribe":
      return <SubscribeScene s={s} />;
  }
};
