/** One small helper for the LLM calls outside step 1: Groq (free tier) or Claude, JSON out. */
import { env } from "./lib";

const PROVIDER = (process.env.LLM_PROVIDER ?? (process.env.GROQ_API_KEY && !process.env.ANTHROPIC_API_KEY ? "groq" : "anthropic")) as "anthropic" | "groq";
const MODEL = PROVIDER === "groq" ? (process.env.GROQ_MODEL ?? "openai/gpt-oss-120b") : (process.env.CLAUDE_MODEL ?? "claude-sonnet-5-5");

export async function askJSON<T>(system: string, user: string): Promise<T> {
  let text: string;
  if (PROVIDER === "groq") {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("GROQ_API_KEY")}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`Groq API ${res.status}: ${await res.text()}`);
    text = ((await res.json()) as { choices: { message: { content: string } }[] }).choices[0].message.content;
  } else {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 8000, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
    text = ((await res.json()) as { content: { text?: string }[] }).content.map((c) => c.text ?? "").join("");
  }
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as T;
}
