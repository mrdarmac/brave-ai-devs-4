import { OPENROUTER_KEY, AIDEVS_KEY, AIDEVS_API_URL } from "../config.js";

const MODEL = "openai/gpt-5-mini";

const systemPrompt = `You command a search and rescue team.
Your task is to find and evacuate a survivor hiding in city ruins.
You can move around the city by transporters and by foot.
Transporters can only move on the streets.
Before you send in a scout, carefully analyze the map.
As soon as your scout finds the man we are looking for, call in evac Helicopter.

Available resources:
- 4 transporters
- 8 scouts
- 300 action points
- 11x11 map with terrain markings

Plan:
1. Learn actions costs by calling {action: "actionCost"}
2. Learn map layout by calling {action: "getMap"}
3. Find the survivor and evacuate.
4. If the tool sends back "FLG" mission is completed.

Hints:
Last message from the survivor - "I hid in one of the tallest blocks."

Available actions:[
  {
    action: 'reset',
    description: 'Resets board state, queue and action points to defaults, then rolls partisan position again.',
  },
  {
    action: 'create',
    description: 'Creates a new transporter or scout unit on the next free spawn slot (A6 -> D6).',
    params: {
      type: 'transporter|scout',
      passengers: '1-4 (required only for transporter)'
    }
  },
  {
    action: 'move',
    description: 'Queues movement of a unit to target field with calculated path (road-only for transporter, shortest orthogonal for scout).',
    params: { object: 'hash', where: 'A1..K11' }
  },
  {
    action: 'inspect',
    description: 'Performs scout reconnaissance and appends a log entry based on current scout field.',
    params: { object: 'hash (scout)' }
  },
  {
    action: 'dismount',
    description: 'Removes selected number of scouts from transporter and spawns them on free tiles around vehicle.',
    params: { object: 'hash (transporter)', passengers: '1-4' }
  },
  {
    action: 'getObjects',
    description: 'Returns all currently known units with type, position and identifier.',
  },
  {
    action: 'getMap',
    description: 'Returns clean map layout; optional symbols filter keeps only selected symbols/fields.',
    params: {
      symbols: '[optional] array of 2-char symbols or coordinates (e.g. KS, SZ, B3, C4)'
    }
  },
  {
    action: 'searchSymbol',
    description: 'Searches clean map for all fields matching the provided 2-character symbol.',
    params: { symbol: 'exactly 2 alphanumeric characters' }
  },
  {
    action: 'getLogs',
    description: 'Returns collected inspect log entries.',
  },
  {
    action: 'expenses',
    description: 'Returns action points spending history (action name and action cost).',
  },
  {
    action: 'actionCost',
    description: 'Returns action points cost rules for all operations.',
  },
  {
    action: 'callHelicopter',
    description: 'Calls evacuation helicopter to selected destination, but only after any scout confirms a human.',
    params: { destination: 'A1..K11' }
  }
]

Important - always refer to available actions before calling the tool.`;

const tools = [
  {
    type: "function",
    function: {
      name: "executeOrder",
      description:
        "Execute a game action. Examples: {action: 'actionCost'}, {action: 'create', type: 'transporter', passengers: 4}, {action: 'move', object: 'hash', where: 'E5'}, {action: 'inspect', object: 'hash'}, {action: 'dismount', object: 'hash', passengers: 2}, {action: 'getMap'}, {action: 'getObjects'}, {action: 'searchSymbol', symbol: 'B3'}, {action: 'callHelicopter', destination: 'F1'}",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [
              "reset",
              "create",
              "move",
              "inspect",
              "dismount",
              "getObjects",
              "getMap",
              "searchSymbol",
              "getLogs",
              "expenses",
              "actionCost",
              "callHelicopter",
            ],
          },
          type: { type: "string", enum: ["transporter", "scout"] },
          passengers: { type: "number", minimum: 1, maximum: 4 },
          object: { type: "string" },
          where: { type: "string" },
          destination: { type: "string" },
          symbols: { type: "array", items: { type: "string" } },
          symbol: { type: "string" },
        },
        required: ["action"],
      },
    },
  },
];

const handlers = {
  executeOrder: async function (body) {
    const cleanBody = Object.fromEntries(
      Object.entries(body).filter(([_, v]) => v !== "" && !(Array.isArray(v) && v.length === 0)),
    );

    const response = await fetch(`${AIDEVS_API_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: AIDEVS_KEY,
        task: "domatowo",
        answer: cleanBody,
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
  const maxIterations = 50;

  await handlers.executeOrder({ action: "reset" });

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

        const result = await handlers.executeOrder(toolArgs);
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
