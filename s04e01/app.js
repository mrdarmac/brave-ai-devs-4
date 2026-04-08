import { OPENROUTER_KEY, AIDEVS_KEY, AIDEVS_API_URL, AIDEVS_OKO_API_URL } from "../config.js";

const MODEL = "openai/gpt-5-mini";
const systemPrompt = `You are an agent managing the OKO Operational Center through its API.

## Your Task
Make 4 specific changes in the OKO system using interactAPI, then call "done".

## Available Tools
### interactAPI

Use this to interact with the central API at /verify:
- Make changes to incidents and tasks
- Call done when finished: { action: "done" }
- ALL changes must be made through this tool

### browseOKO
Browse the OKO web panel to READ current state:
- Use paths like "/incydenty", "/zadania", "/notatki"
- Returns cleaned HTML for reading only
- Use this to explore and understand the current state before making changes
- Do NOT make changes through this tool

## Your Objectives (complete all 4 in Polish):

1. CHANGE INCIDENT CLASSIFICATION: Find the incident about Skolwin city (Skolwin) and change its classification from vehicles/people seen to animals (zwierzęta). Use Polish terms.

2. MARK TASK AS DONE: Find the task related to Skolwin in the task list, mark it as done, and write in its content that animals were seen (e.g., "bobry" - beavers).

3. CREATE NEW INCIDENT: Create a new incident report about human movement (ruch ludzi) near Komarowo city to redirect operator attention away from Skolwin.

4. CALL DONE: When all changes are made, call interactAPI with { action: "done" }.

## Important Rules
- ALL changes must be in POLISH (the website is in Polish)
- Use ONLY interactAPI for making changes
- Use browseOKO only for reading/exploring the current state
- Use interactAPI to discover available actions with { action: "help" }`;

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
const tools = [
  {
    type: "function",
    function: {
      name: "interactAPI",
      description: "Interact with the OKO editor API",
      parameters: {
        type: "object",
        properties: {
          answer: {
            type: "object",
            description: "Answer object to send to the API (e.g., {action: 'help'})",
          },
        },
        required: ["answer"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browseOKO",
      description: "Browse pages on the OKO website",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Page path to fetch (e.g., '/', '/notatki')",
          },
        },
        required: ["path"],
      },
    },
  },
];

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
  browseOKO: async function (path) {
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

async function LLM(history) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...history],
      tools,
    }),
  });

  if (!response.ok) {
    console.error("LLM request failed:", response.status, await response.text());
    process.exit(1);
  }

  return response.json();
}

async function main() {
  //   const help = await handlers.interactAPI({ action: "help" });
  await loginToOko();
}

await main();
