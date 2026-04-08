import { OPENROUTER_KEY, AIDEVS_KEY, AIDEVS_API_URL, AIDEVS_OKO_API_URL } from "../config.js";

const MODEL = "openai/gpt-5-mini";
const systemPrompt = ``;

let okoSession;

async function loginToOko() {
  const body = new URLSearchParams({
    action: "login",
    login: "Zofia",
    password: "Zofia2026!",
    access_key: AIDEVS_KEY,
  });

  const res = await fetch(`${AIDEVS_OKO_API_URL}/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "manual",
  });

  const cookies = res.headers.getSetCookie();
  for (const c of cookies) {
    const m = c.match(/oko_session=([^;]+)/);
    if (m) okoSession = m[1];
  }
  if (!okoSession) throw new Error("OKO login failed — no session cookie");
  console.log("OKO login OK, session:", okoSession);
}
const tools = [];

const handlers = {
  interactAPI: async function (answer) {
    const response = await fetch(`${AIDEVS_API_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: AIDEVS_KEY,
        task: "okoeditor",
        answer,
      }),
    });
    return response.json();
  },
  browseOKO: async function (path, okoSession) {
    if (!okoSession) await loginToOko();

    const res = await fetch(`${AIDEVS_OKO_API_URL}${path}`, {
      headers: { Cookie: `oko_session=${okoSession}` },
    });
    let html = await res.text();

    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => `[LINK: ${href}] ${text}`);
    html = html.replace(/<[^>]+>/g, "\n");
    return html
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n");
  },
};

async function LLM() {}

async function main() {
  //   const help = await handlers.interactAPI({ action: "help" });
  await loginToOko();
}

await main();
