import tools from "./tools.js";
import handlers from "./handlers.js";
import { OPENROUTER_KEY } from "../config.js";
const systemPrompt = `Jesteś agentem odpowiedzialnym za aktywację trasy kolejowej X-01 przez API.

Masz do dyspozycji następujące narzędzia:
1. callAPI(action, args) - wywołuje akcję API
2. wait_and_retry(retry_after) - czeka określoną liczbę sekund przed ponowną próbą

API jest celowo przeciążone i może zwracać:
- Błędy 503 (tymczasowa awaria) - użyj wait_and_retry i spróbuj ponownie
- Błędy 429 (przekroczony limit) - użyj wartości retry_after z odpowiedzi i poczekaj
- Błędy z ujemnym kodem - komunikat błędu precyzyjnie wskazuje co poszło nie tak

Kolejność akcji do aktywacji trasy X-01:
1. Najpierw wywołaj action=help aby poznać pełną dokumentację API
2. Następnie postępuj zgodnie z instrukcjami z help - najpierw reconfigure, potem setstatus, na końcu save

WAŻNE:
- Zawsze czekaj na odpowiedni czas przed ponownym wywołaniem API (nie wcześniej niż wskazuje retry_after)
- Jeśli pierwsza odpowiedź help jest niepełna lub masz wątpliwości, wywołaj help ponownie
- Trasa X-01 musi być najpierw w trybie reconfigure zanim będzie można zmienić jej status
- Po zmianie statusu użyj save aby zapisać zmiany

Twoim celem jest aktywowanie trasy X-01 (ustawienie jej statusu na RTOPEN).`;

const callLLM = async function (messages, tools) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: messages,
        tools: tools,
        tool_choice: "auto",
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
};

const executeToolCall = async function (toolName, toolArgs) {
  if (toolName === "callAPI") {
    return await handlers.call_API(toolArgs.action, toolArgs.args);
  } else if (toolName === "wait_and_retry") {
    await handlers.wait_and_retry(toolArgs.retry_after);
    return { waited: true, retry_after: toolArgs.retry_after };
  } else {
    throw new Error(`Unknown tool: ${toolName}`);
  }
};

const agent = async function () {
  const MAX_ITERATIONS = 15;
  const history = [{ role: "system", content: systemPrompt }];

  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    const timestamp = new Date().toISOString();
    console.log(`\n${"=".repeat(60)}`);
    console.log(`[${timestamp}] [ITERATION ${iteration}/${MAX_ITERATIONS}]`);
    console.log("=".repeat(60));

    let llmResponse;
    try {
      llmResponse = await callLLM(history, tools);
    } catch (error) {
      console.error(`[LLM ERROR] ${error.message}`);
      history.push({
        role: "assistant",
        content: `Error calling LLM: ${error.message}`,
      });
      continue;
    }

    const choice = llmResponse.choices[0];
    const message = choice.message;

    if (choice.finish_reason === "stop") {
      console.log(`[LLM] Final response: ${message.content}`);
      return message.content;
    }

    if (!message.tool_calls || message.tool_calls.length === 0) {
      console.log(`[LLM] No tool calls, continuing...`);
      history.push(message);
      continue;
    }

    console.log(
      `[LLM] Tool calls: ${message.tool_calls.map((t) => t.function.name).join(", ")}`,
    );
    history.push(message);

    for (const toolCall of message.tool_calls) {
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      console.log(`[TOOL] Executing ${toolName} with args:`, toolArgs);

      try {
        const result = await executeToolCall(toolName, toolArgs);
        console.log(
          `[TOOL] ${toolName} result:`,
          JSON.stringify(result, null, 2),
        );

        history.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });

        if (result.code && result.code === 0) {
          console.log(`\n${"*".repeat(60)}`);
          console.log("[SUCCESS] Task completed successfully!");
          console.log("*".repeat(60));
          return result;
        }
      } catch (error) {
        console.error(`[TOOL ERROR] ${toolName} failed: ${error.message}`);
        history.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: error.message }),
        });
      }
    }
  }

  console.log(`\n[AGENT] Max iterations (${MAX_ITERATIONS}) reached.`);
  return null;
};

const main = async function () {
  const startTimestamp = new Date().toISOString();
  console.log("Starting Railway Agent...");
  console.log(`Start time: ${startTimestamp}`);

  try {
    const result = await agent();
    const endTimestamp = new Date().toISOString();
    console.log(`\nEnd time: ${endTimestamp}`);
    console.log("Final result:", result);
  } catch (error) {
    console.error("Agent failed:", error);
  }
};

main();
