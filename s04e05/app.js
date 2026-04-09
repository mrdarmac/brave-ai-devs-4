import { OPENROUTER_KEY, AIDEVS_KEY, AIDEVS_API_URL } from "../config.js";

const MODEL = "openai/gpt-5-mini";

const cityNeeds = await fetch(`${AIDEVS_API_URL}/dane/food4cities.json`);
const cityNeedsString = await JSON.stringify(await cityNeeds.json());
console.log(cityNeedsString);

const systemPrompt = `Your task is to prepare warehouse orders to satisfy all city needs.

Requirements:
- Use food4cities.json data (provided below) to know which cities need what
- Query SQLite database for city destination codes and creator IDs
- Generate SHA1 signatures using signatureGenerator tool
- Create separate order for each city with correct items

Data (food4cities.json):
${cityNeedsString}

Plan:
1. Call interactAPI with {"tool":"help"} to learn available tools
2. Use database tool to query:
   - Find city destination codes (where cities are located)
   - Find creator IDs (who manages each city)
3. Use signatureGenerator to create valid signatures for each order
4. Create orders using orders tool:
   - First create with orders->create (title, creatorID, destination, signature)
   - Then append items with orders->append
5. Call {"tool":"done"} to verify
6. If failed, call {"tool":"reset"} and start again

Important:
- Each order must have correct creatorID, destination, and signature from database
- Match exact items and quantities from food4cities.json
- Use batch_mode in orders->append to add multiple items at once
- Query users with role=2 (role_id=2 means "Obsługa transportów" - people responsible for transport)
- Use ONLY users with role=2 as creatorIDs
- Assign 8 of them to the 8 cities in this order: Opalino, Domatowo, Brudzewo, Darzlubie, Celbowo, Mechowo, Puck, Karlinkowo
- If orders fail validation, use reset and try different mapping
`;

const tools = [
  {
    type: "function",
    function: {
      name: "interactAPI",
      description:
        "Interact with the API. Use 'help' to discover available tools. Build a JSON string (single object or array for batch_mode).",
      parameters: {
        type: "object",
        properties: {
          input: {
            type: "string",
            description:
              'JSON string representing the tool(s). Example single: \'{"tool":"help"}\'. Example batch: \'[{"tool": "orders","action": "get"},...]\'. Learn format from \'help\'.',
          },
        },
        required: ["input"],
      },
    },
  },
];

const handlers = {
  interactAPI: async function (params) {
    const input = JSON.parse(params.input);
    const response = await fetch(`${AIDEVS_API_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: AIDEVS_KEY,
        task: "foodwarehouse",
        answer: input,
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
  const history = [];
  const maxIterations = 80;

  for (let i = 0; i < maxIterations; i++) {
    const agent = await LLM(history);
    const agentMsg = agent.choices[0].message;
    console.log("Agent:", agentMsg.content);

    if (agentMsg.tool_calls && agentMsg.tool_calls.length > 0) {
      history.push(agentMsg);
      for (const toolCall of agentMsg.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        console.log("Executing:", toolName, toolArgs);

        await new Promise((resolve) => setTimeout(resolve, 2000));

        const result = await handlers[toolName](toolArgs);
        console.log("Result:", JSON.stringify(result));

        if (JSON.stringify(result).includes("FLG")) {
          console.log("MISSION COMPLETE!");
          console.log("Full result:", JSON.stringify(result));
          return;
        }

        history.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    } else {
      history.push({ role: "assistant", content: agentMsg.content });
    }
  }

  console.log("Max iterations reached - mission failed to complete");
}

main();
