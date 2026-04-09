import { OPENROUTER_KEY, AIDEVS_KEY, AIDEVS_API_URL } from "../config.js";

const MODEL = "openai/gpt-5-mini";

const systemPrompt = ``;

const tools = [
  {
    type: "function",
    function: {
      name: "interactAPI",
      description: "Interact with the filesystem API.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            description: "The filesystem action to perform",
          },
        },
        required: ["action"],
        additionalProperties: true,
      },
    },
  },
];

const handlers = {
  interactAPI: async function (params) {
    const response = await fetch(`${AIDEVS_API_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: AIDEVS_KEY,
        task: "filesystem",
        answer: params,
      }),
    });
    return response.json();
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
      tools: tools,
    }),
  });

  if (!response.ok) {
    console.error("LLM request failed:", response.status, await response.text());
    process.exit(1);
  }

  return response.json();
}

async function main() {
  const help = await handlers.interactAPI({ action: "help" });
  console.log(help);
}

main();
