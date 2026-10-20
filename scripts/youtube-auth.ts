/**
 * One-time: get a YouTube refresh token for the channel.
 * 1. Google Cloud Console → enable "YouTube Data API v3" → OAuth client (type: Desktop app)
 * 2. Put YT_CLIENT_ID / YT_CLIENT_SECRET in .env
 * 3. npx tsx scripts/youtube-auth.ts → open the URL, sign in with the CHANNEL's Google account
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import { ROOT, env } from "./lib";

const PORT = 53682;
const auth = new google.auth.OAuth2(env("YT_CLIENT_ID"), env("YT_CLIENT_SECRET"), `http://localhost:${PORT}`);
const url = auth.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube"],
});
console.log("Open this URL and approve:\n", url);

http
  .createServer(async (req, res) => {
    const code = new URL(req.url ?? "/", `http://localhost:${PORT}`).searchParams.get("code");
    if (!code) return res.end("no code");
    const { tokens } = await auth.getToken(code);
    const envFile = path.join(ROOT, ".env");
    const old = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8").replace(/^YT_REFRESH_TOKEN=.*\n?/m, "") : "";
    fs.writeFileSync(envFile, `${old.trimEnd()}\nYT_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    res.end("Done — you can close this tab.");
    console.log("Saved YT_REFRESH_TOKEN to .env");
    process.exit(0);
  })
  .listen(PORT);
