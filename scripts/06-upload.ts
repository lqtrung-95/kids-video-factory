/**
 * Step 6 — upload to YouTube as PRIVATE, Made for Kids, with thumbnail, into the video's playlists.
 * A human reviews in YouTube Studio and publishes — and ticks "Altered or synthetic content" (AI music/voices).
 *   npx tsx scripts/06-upload.ts <slug>
 * One-time auth: npx tsx scripts/youtube-auth.ts  → puts YT_REFRESH_TOKEN in .env
 *
 * Playlists come from meta.playlists in content/<slug>.json ("Animal Songs", …). They are created
 * on the channel the first time (public), so viewers keep watching one song after another.
 * Thumbnail variants (thumbnail-hero.jpg, thumbnail-pop.jpg) are not uploaded: add them in
 * YouTube Studio → Thumbnail → "Test & compare".
 */
import fs from "node:fs";
import path from "node:path";
import { google, type youtube_v3 } from "googleapis";
import { ROOT, env, load, log } from "./lib";

const slug = process.argv[2];
if (!slug) throw new Error("Usage: tsx scripts/06-upload.ts <slug>");
const dir = path.join(ROOT, "out", slug);
const video = path.join(dir, `${slug}.mp4`);
if (!fs.existsSync(video)) throw new Error(`Render first: ${video} not found`);
const meta = JSON.parse(fs.readFileSync(path.join(dir, "youtube.json"), "utf8"));
const playlists: string[] = meta.playlists ?? load(slug).meta.playlists ?? [];

/** Find a playlist on the channel by title, or create it. */
const playlistId = async (yt: youtube_v3.Youtube, title: string): Promise<string> => {
  let pageToken: string | undefined;
  do {
    const r = await yt.playlists.list({ part: ["snippet"], mine: true, maxResults: 50, pageToken });
    const hit = r.data.items?.find((p) => p.snippet?.title === title);
    if (hit?.id) return hit.id;
    pageToken = r.data.nextPageToken ?? undefined;
  } while (pageToken);
  const r = await yt.playlists.insert({
    part: ["snippet", "status"],
    requestBody: { snippet: { title, description: `${title} — sing-along songs for kids` }, status: { privacyStatus: "public" } },
  });
  log(`created playlist "${title}"`);
  return r.data.id!;
};

(async () => {
  const auth = new google.auth.OAuth2(env("YT_CLIENT_ID"), env("YT_CLIENT_SECRET"));
  auth.setCredentials({ refresh_token: env("YT_REFRESH_TOKEN") });
  const yt = google.youtube({ version: "v3", auth });

  log("uploading…");
  const res = await yt.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: meta.title.slice(0, 100),
        description: meta.description,
        tags: meta.tags,
        categoryId: "27", // Education
        defaultLanguage: "en",
        defaultAudioLanguage: "en",
      },
      status: { privacyStatus: "private", selfDeclaredMadeForKids: meta.madeForKids ?? true, embeddable: true },
    },
    media: { body: fs.createReadStream(video) },
  });
  const id = res.data.id!;
  const thumb = path.join(dir, "thumbnail.jpg");
  if (fs.existsSync(thumb)) {
    await yt.thumbnails.set({ videoId: id, media: { mimeType: "image/jpeg", body: fs.createReadStream(thumb) } });
  }
  for (const title of playlists) {
    try {
      const pid = await playlistId(yt, title);
      await yt.playlistItems.insert({ part: ["snippet"], requestBody: { snippet: { playlistId: pid, resourceId: { kind: "youtube#video", videoId: id } } } });
      log(`added to playlist "${title}"`);
    } catch (e) {
      log(`⚠ could not add to playlist "${title}": ${String(e).slice(0, 200)}`);
    }
  }
  log(`uploaded as PRIVATE → https://studio.youtube.com/video/${id}/edit  (review, tick "Altered or synthetic content", then publish)`);
  const variants = ["hero", "pop"].filter((l) => fs.existsSync(path.join(dir, `thumbnail-${l}.jpg`)));
  if (variants.length) log(`thumbnail A/B: in Studio → Thumbnail → Test & compare, add ${variants.map((l) => `thumbnail-${l}.jpg`).join(" + ")}`);
  const dubs = fs.readdirSync(dir).filter((f) => /\.[a-z]{2}\.m4a$/.test(f));
  if (dubs.length) log(`extra audio tracks: in Studio → Languages → Add audio, upload ${dubs.join(", ")}`);
})();
