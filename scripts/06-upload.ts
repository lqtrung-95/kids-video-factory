/**
 * Step 6 — upload to YouTube as PRIVATE, Made for Kids, with thumbnail.
 * A human reviews in YouTube Studio and publishes (also where you tick "Altered or synthetic content" if needed).
 *   npx tsx scripts/06-upload.ts <slug>
 * One-time auth: npx tsx scripts/youtube-auth.ts  → puts YT_REFRESH_TOKEN in .env
 */
import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import { ROOT, env, log } from "./lib";

const slug = process.argv[2];
if (!slug) throw new Error("Usage: tsx scripts/06-upload.ts <slug>");
const dir = path.join(ROOT, "out", slug);
const video = path.join(dir, `${slug}.mp4`);
if (!fs.existsSync(video)) throw new Error(`Render first: ${video} not found`);
const meta = JSON.parse(fs.readFileSync(path.join(dir, "youtube.json"), "utf8"));

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
  log(`uploaded as PRIVATE → https://studio.youtube.com/video/${id}/edit  (review, then publish)`);
})();
