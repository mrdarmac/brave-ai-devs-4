import { OPENROUTER_KEY, AIDEVS_KEY, AIDEVS_API_URL } from "../config.js";

const MODEL = "gpt-4o-mini";
const systemPrompt = ``;

const tools = [
  {
    type: "function",
    function: {
      name: "useTool",
      description: "Call a tool from the AIDEVS API",
      parameters: {
        type: "object",
        properties: {
          toolName: { type: "string", description: "Name of the tool" },
          query: { type: "string", description: "Query for the tool" },
        },
        required: ["toolName", "query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "checkPath",
      description: "Check if the path is correct.",
      parameters: {
        type: "object",
        properties: {
          answer: {
            type: "array",
            items: { type: "string" },
            description: "Array of directions, e.g. ['vehicle_name', 'right', 'up', 'down', ...]",
          },
        },
        required: ["answer"],
      },
    },
  },
];

const handlers = {
  useTool: async function (toolName, query) {
    const response = await fetch(`${AIDEVS_API_URL}/api/${toolName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: AIDEVS_KEY,
        query,
      }),
    });

    return response.json();
  },
  checkPath: async function (answer) {
    const response = await fetch(`${AIDEVS_API_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: AIDEVS_KEY,
        task: "savethem",
        answer,
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
  const history = [];
  const maxIterations = 20;
  for (let i = 0; i < maxIterations; i++) {
    const agent = await LLM(history);
    console.log("Agent:", agent.choices[0].message);

    const toolCalls = agent.choices[0].message.tool_calls;
    if (toolCalls) {
      for (const call of toolCalls) {
        const funcName = call.function.name;
        const args = JSON.parse(call.function.arguments);
        console.log(`Calling ${funcName}:`, args);

        try {
          let result;
          if (funcName === "useTool") {
            result = await handlers[funcName](args.toolName, args.query);
          } else if (funcName === "checkPath") {
            result = await handlers[funcName](args.answer);
          }
          const resultStr = JSON.stringify(result);
          console.log("Result:", resultStr);

          history.push({ role: "assistant", content: null, tool_calls: [call] });
          history.push({ role: "tool", tool_call_id: call.id, content: resultStr });
        } catch (err) {
          console.error("Error calling tool:", err);
          history.push({ role: "assistant", content: null, tool_calls: [call] });
          history.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: err.message }) });
        }
      }
    } else {
      const content = agent.choices[0].message.content;
      console.log("Response:", content);
      history.push({ role: "assistant", content });
    }
  }
}
