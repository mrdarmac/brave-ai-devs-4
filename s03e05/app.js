import { OPENROUTER_KEY, AIDEVS_KEY, AIDEVS_API_URL } from "../config.js";

const MODEL = "openai/gpt-5-mini";
const systemPrompt = `You are planning an optimal route for a messenger to reach Skolwin city.

Your task:
1. First use useTool with toolName="toolsearch" to discover available tools (start with query="I need notes about movement rules and terrain and vehicles.")
2. Query those tools using useTool to get the information you need:
a) Get Skolwin map
b) Get vehicles fuel consumption rates
3. Plan the optimal route considering:
   - 10 food portions and 10 fuel units available
   - Different vehicles have different fuel consumption rates. You can't plan successful route without knowing fuel consumption rates.
   - You can exit vehicle and continue on foot at any time using the "dismount" command
   - Vehicle can only be selected in the first step - to switch to walk, use "dismount"
   - Before submitting, write out each step as coordinates (row, col) and verify no obstacle exists at that position
4. Submit your path using checkPath function with format: ["vehicle_name", "up", "right", "up", ...]

Important:
- Each tool's query can be either full sentence or just a keyword.(maps tool? use city name. Vehicles tool? use vehicle name)
- If a tool returns an error or unhelpful result, try rephrasing your query.
- Don't give up if one query fails - try different variations and approaches.
- Do not plan a route unless you have the necessary information like terrain map and vehicles fuel consumption rates.
- When you reach the final field, you'll get the flag and complete the task`;

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
  const maxIterations = 40;
  for (let i = 0; i < maxIterations; i++) {
    const agent = await LLM(history);
    if (!agent.choices || !agent.choices[0]) {
      console.log("Unexpected response:", JSON.stringify(agent, null, 2));
      if (agent.error) {
        console.log("LLM Error:", agent.error.message);
      }
      break;
    }
    const message = agent.choices[0].message;
    if (message.content) {
      console.log("Agent:", message.content);
    } else {
      console.log("Agent: (no message)");
    }

    const toolCalls = message.tool_calls;
    if (toolCalls) {
      for (const call of toolCalls) {
        const funcName = call.function.name;
        const args = JSON.parse(call.function.arguments);
        console.log("=".repeat(50));
        console.log(`Calling ${funcName}:`, args);

        try {
          let result;
          if (funcName === "useTool") {
            result = await handlers[funcName](args.toolName, args.query);
          } else if (funcName === "checkPath") {
            result = await handlers[funcName](args.answer);
            console.log("Submitting path:", args.answer);
          }
          const resultStr = JSON.stringify(result);
          if (resultStr.includes("FLG")) {
            console.log("EXERCISE COMPLETE! Flag found:", resultStr);
            return;
          }
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
      const content = message.content;
      if (content) {
        console.log("Final response:", content);
      }
      console.log("=== DONE - No more tool calls ===");
      history.push({ role: "assistant", content });
      break;
    }
  }
}

main();
