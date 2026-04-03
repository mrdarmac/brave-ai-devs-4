import { OPENROUTER_KEY } from "../config.js";
import tools from "./tools.js";
import handlers from "./handlers.js";

const agent = async function () {
  const systemPrompt = `You are an agent searching a mailbox.
  We know that an email from Wiktor landed in this inbox - we don't know his last name, but we know he reported us.
  We need to search through the inbox via API and extract three pieces of information:
  password, date, confirmation_code and send them via the verify tool.

1. Start by calling api_interact with {action: "help"} ONCE to learn the API.
2. The mailbox is in polish so search using polish language!
3. The sender is vik4tor@proton.me (not wiktor). Search for emails from him or about him.
4. Look for: password, confirmation code, and date.
5. After finding all 3 values, call verify. If wrong, keep searching - mailbox is active.
6. DON'T repeat failed searches. Try different approaches.
7. The mailbox is active - try searches multiple times as values may change
8. Continue until hub returns {FLG:...}`;

  const history = [{ role: "system", content: systemPrompt }];
  const maxIterations = 12;

  for (let i = 0; i < maxIterations; i++) {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: history,
          tools: tools,
        }),
      },
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error("API Error:", data);
      return;
    }

    const message = data.choices[0].message;

    if (!message.tool_calls) {
      console.log("Final result:", message.content);
      return message.content;
    }

    const toolResults = [];
    for (const toolCall of message.tool_calls) {
      const { name, arguments: args } = toolCall.function;
      const params = JSON.parse(args);

      console.log(`Tool call [${i}]:`, name, params);

      const result = await handlers[name](params);
      toolResults.push({ id: toolCall.id, result });
    }

    history.push(message);
    for (const { id, result } of toolResults) {
      history.push({
        role: "tool",
        tool_call_id: id,
        content: JSON.stringify(result),
      });
    }
  }
  console.log("=".repeat(50));
  console.log("=".repeat(50));
  console.log("Max iterations reached");
  console.log("=".repeat(50));
  console.log("=".repeat(50));
  console.log(history);
};

const main = async function () {
  await agent();
};

main();
