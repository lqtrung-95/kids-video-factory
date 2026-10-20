import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { Doodles, PALETTE } from "./components/Decor";
import { PopText, fit, outline } from "./components/Text";
import { DISPLAY } from "./fonts";
import { KidsVideo } from "./Video";
import type { VideoProps } from "./schema";

export type ShortProps = VideoProps & { short: { from: number; to: number; title: string; bg?: string } };

/**
 * Vertical 1080×1920 Short cut from a finished video: the original 16:9 frames play in the middle
 * (with their own song / narration / music), a big hook title sits on top, the channel at the bottom.
 */
export const KidsShort: React.FC<ShortProps> = (props) => {
  const { fps, width } = useVideoConfig();
  const { short, ...video } = props;
  const scale = width / 1920;
  return (
    <AbsoluteFill style={{ background: short.bg ?? "linear-gradient(#FFE7B3, #FFD1E3)" }}>
      <Doodles />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 170, paddingLeft: 50, paddingRight: 50 }}>
        <PopText
          size={fit(short.title, 980, 110)}
          color={PALETTE.brown}
          stroke="#FFFFFF"
          strokeW={9}
          style={{ textAlign: "center", whiteSpace: "normal", maxWidth: 980 }}
        >
          {short.title}
        </PopText>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            width: 1920,
            height: 1080,
            transform: `scale(${scale})`,
            borderRadius: 40 / scale,
            overflow: "hidden",
            boxShadow: "0 20px 0 rgba(0,0,0,0.15)",
            border: `${10 / scale}px solid #FFFFFF`,
            flexShrink: 0,
            position: "relative",
          }}
        >
          {/* negative `from` = start playing the full video at short.from */}
          <Sequence from={-Math.round(short.from * fps)} layout="absolute-fill">
            <KidsVideo {...video} />
          </Sequence>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 230 }}>
        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: 64,
            color: "#FFFFFF",
            background: "#E62117",
            padding: "8px 40px 16px",
            borderRadius: 999,
            textShadow: outline("#B5160F", 2),
          }}
        >
          {video.meta.channel}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
