import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import { Drift, Entrance, Particles, type Fx, type Transition } from "./components/Motion";
import { loadFonts } from "./fonts";
import { SceneView } from "./scenes/Scenes";
import { sceneStarts, type Scene, type VideoProps } from "./schema";

loadFonts();

/** Transition rotation when a scene says "auto": varied, but calm for title/intro cards. */
const AUTO: Record<string, Transition[]> = {
  intro: ["pop"],
  subscribe: ["zoom"],
  title: ["iris"],
  lyric: ["slide", "iris", "zoom", "swing", "slideUp", "slide"],
  default: ["slide", "pop", "iris", "slideUp", "zoom", "swing"],
};

const AUTO_FX: Record<string, Fx> = { title: "sparkles", outro: "hearts", subscribe: "sparkles" };

const SceneWrap: React.FC<{ s: Scene; index: number; children: React.ReactNode }> = ({ s, index, children }) => {
  const { fps } = useVideoConfig();
  const list = AUTO[s.type] ?? AUTO.default;
  const kind = s.transition && s.transition !== "auto" ? s.transition : list[index % list.length];
  return (
    <Entrance kind={kind} seed={index}>
      <Drift seed={index} durationInFrames={Math.round(s.duration * fps)} amount={s.type === "lyric" ? 1 : 0.6}>
        <AbsoluteFill data-scene={s.type}>{children}</AbsoluteFill>
      </Drift>
      {/* song scenes draw their own particles; other scenes: explicit fx, or a default for title/outro */}
      {s.type !== "lyric" ? <Particles kind={s.fx && s.fx !== "auto" ? s.fx : (AUTO_FX[s.type] ?? "none")} seed={index + 3} count={16} /> : null}
    </Entrance>
  );
};

/**
 * Audio layout:
 *  - song   : plays once over the lyric scenes (the song part)
 *  - bgm    : loops under everything else (intro, learning cards, outro), ideally the song's
 *             instrumental; fades out around the song and ducks under narration
 *  - voice  : per-scene narration
 */
export const KidsVideo: React.FC<VideoProps> = ({ scenes, audio }) => {
  const { fps } = useVideoConfig();
  const { starts, total } = sceneStarts(scenes);
  const songStart = audio?.songStart ?? 0;
  const lyricIdx = scenes.flatMap((s, i) => (s.type === "lyric" ? [i] : []));
  const last = lyricIdx[lyricIdx.length - 1];
  const songEnd = lyricIdx.length ? starts[last] + scenes[last].duration : 0;

  const bgmVolumeAt = (t: number) => {
    let v = 1;
    if (audio?.song) v = Math.min(1, Math.max(0, (songStart - t) / 0.6, (t - songEnd) / 0.6));
    const i = starts.findIndex((st, k) => t >= st && t < st + scenes[k].duration);
    const duck = scenes[i]?.voice ? audio.bgmDuck : 1;
    const fadeOut = Math.min(1, Math.max(0, (total - t) / 1.5));
    return audio.bgmVolume * v * duck * fadeOut;
  };

  const bgmLen = audio?.bgmDuration;
  const loops = audio?.bgm && bgmLen ? Math.ceil(total / bgmLen) : 0;

  return (
    <AbsoluteFill style={{ background: "#FFFFFF" }}>
      {scenes.map((s, i) => (
        <Sequence
          key={i}
          from={Math.round(starts[i] * fps)}
          // stay on screen ~0.5 s longer, underneath the next scene, so its transition reveals
          // this scene instead of a white background
          durationInFrames={Math.round(s.duration * fps) + (i < scenes.length - 1 ? 15 : 0)}
          name={`${i}:${s.type}`}
        >
          <SceneWrap s={s} index={i}>
            <SceneView s={s} />
          </SceneWrap>
          {s.voice ? (
            <Sequence from={Math.round(s.voiceOffset * fps)}>
              <Audio src={staticFile(s.voice)} />
            </Sequence>
          ) : null}
        </Sequence>
      ))}
      {audio?.song ? (
        <Sequence
          from={Math.round(songStart * fps)}
          durationInFrames={audio.songEnd ? Math.round(audio.songEnd * fps) : undefined}
          name="song"
        >
          <Audio
            src={staticFile(audio.song)}
            volume={(f) => audio.songVolume * (audio.songEnd ? Math.min(1, Math.max(0, (audio.songEnd - f / fps) / 1.2)) : 1)}
          />
        </Sequence>
      ) : null}
      {/* explicit loops rather than <Audio loop>, so the volume curve sees absolute time */}
      {Array.from({ length: loops }).map((_, k) => {
        const off = Math.round(k * bgmLen! * fps);
        return (
          <Sequence key={`bgm${k}`} from={off} durationInFrames={Math.round(bgmLen! * fps)} name={`bgm ${k + 1}`}>
            <Audio src={staticFile(audio.bgm!)} volume={(f) => bgmVolumeAt((f + off) / fps)} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
