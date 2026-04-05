import { OPENROUTER_KEY, AIDEVS_KEY } from "../config.js";

const MODEL = "gpt-4o-mini";

const systemPrompt = `You control a robot on a grid(7x5).
Robot starts at P, goal is G. Avoid blocks (B) that move up/down each turn.
AVAILABLE COMMANDS: start, reset, left, right, wait.
Use "start" first, then navigate to G using only these commands.
ALWAYS use exactly ONE command per response. Never use multiple commands.
If a move will result in collision with a block you can use "wait".`;

const tools = [
  {
    type: "function",
    function: {
      name: "moveRobot",
      description: "Send command to the robot.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description:
              "Command to execute. Available commands: start, reset, left, right, wait.",
          },
        },
        required: ["command"],
        additionalProperties: false,
      },
    },
  },
];

const handlers = {
  moveRobot: async function (command) {
    const response = await fetch("/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: AIDEVS_KEY,
        task: "reactor",
        answer: { command },
      }),
    });

    return response.json();
  },
};

function formatBoardState(result, command) {
  if (result.code === -920 || result.code === -930) {
    return `Move "${command}" failed: ${result.message}`;
  }

  if (result.code === 100 && result.reached_goal) {
    return `SUCCESS! You reached the goal at (${result.goal.col}, ${result.goal.row})!`;
  }

  if (result.board) {
    const p = result.player;
    const g = result.goal;
    const blocks = result.blocks
      .map(
        (b) =>
          `col ${b.col} rows ${b.top_row}-${b.bottom_row} (${b.direction})`,
      )
      .join(", ");

    return `Player at (${p.col}, ${p.row}), Goal at (${g.col}, ${g.row}). Blocks: ${blocks}. Last move: ${command} - OK.`;
  }

  return JSON.stringify(result);
}

async function LLM(messages) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools,
      }),
    },
  );

  if (!response.ok) {
    console.error(
      "LLM request failed:",
      response.status,
      await response.text(),
    );
    process.exit(1);
  }

  return response.json();
}

async function main() {
  const messages = [];
  const maxIterations = 20;

  await handlers.moveRobot("reset");

  for (let i = 0; i < maxIterations; i++) {
    console.log(`\n=== Iteration ${i + 1}/${maxIterations} ===`);

    const completion = await LLM(messages);
    console.log("LLM:", completion.choices[0].message);

    const toolCalls = completion.choices[0].message.tool_calls;
    if (toolCalls) {
      const toolCall = toolCalls[0];
      const command = JSON.parse(toolCall.function.arguments).command;
      console.log("Tool:", toolCall.function.name, toolCall.function.arguments);
      const result = await handlers[toolCall.function.name](command);
      console.log("Result:", result);
      const boardState = formatBoardState(result, command);
      console.log("Board state:", boardState);
      messages.push(completion.choices[0].message);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: boardState,
      });
    } else {
      const content = completion.choices[0].message.content;
      console.log("Response:", content);
      messages.push({ role: "user", content });
    }
  }
}

main();
