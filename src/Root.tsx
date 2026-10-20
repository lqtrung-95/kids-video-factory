import React from "react";
import { Composition, staticFile } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import demo from "../content/hello-around-the-world.json";
import { KidsShort, type ShortProps } from "./Short";
import { KidsVideo } from "./Video";
import { Thumbnail } from "./Thumbnail";
import { arrange } from "./arrange";
import { FPS, sceneStarts, videoSchema, type VideoProps } from "./schema";

const withBgmDuration = async (parsed: VideoProps) => {
  // bgm length is needed to lay its loops on the absolute timeline (see Video.tsx)
  if (parsed.audio.bgm && !parsed.audio.bgmDuration) {
    parsed.audio.bgmDuration = await getAudioDurationInSeconds(staticFile(parsed.audio.bgm));
  }
  return parsed;
};

export const RemotionRoot: React.FC = () => (
  <>
  <Composition
    id="KidsVideo"
    component={KidsVideo}
    schema={videoSchema}
    defaultProps={videoSchema.parse(demo) as VideoProps}
    fps={FPS}
    width={1920}
    height={1080}
    durationInFrames={FPS * 10}
    calculateMetadata={async ({ props }) => {
      // arrange(): chorus breaks + "sing again" ending, added at render time (src/arrange.ts)
      const parsed = arrange(await withBgmDuration(videoSchema.parse(props)));
      return { props: parsed, durationInFrames: Math.ceil(sceneStarts(parsed.scenes).total * FPS) };
    }}
  />
  <Composition
    id="Thumbnail"
    component={Thumbnail}
    schema={videoSchema}
    defaultProps={videoSchema.parse(demo) as VideoProps}
    fps={FPS}
    width={1280}
    height={720}
    durationInFrames={1}
  />
  {/* vertical Shorts cut from a video: props = video JSON + { short: { from, to, title } } (scripts/07-shorts.ts) */}
  <Composition
    id="KidsShort"
    component={KidsShort}
    defaultProps={{ ...(videoSchema.parse(demo) as VideoProps), short: { from: 4, to: 14, title: "Say hello around the world!" } } as ShortProps}
    fps={FPS}
    width={1080}
    height={1920}
    durationInFrames={FPS * 10}
    calculateMetadata={async ({ props }) => {
      const parsed = await withBgmDuration(videoSchema.parse(props));
      const short = (props as ShortProps).short;
      return { props: { ...parsed, short }, durationInFrames: Math.max(1, Math.round((short.to - short.from) * FPS)) };
    }}
  />
  </>
);
