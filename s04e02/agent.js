import { OPENROUTER_KEY, AIDEVS_KEY, AIDEVS_API_URL } from "../config.js";

const MODEL = "openai/gpt-5-mini";
const MAX_ITERATIONS = 15;

const SYSTEM_PROMPT = `Jesteś agentem AI. Twoje zadanie: skonfigurować turbinę wiatrową i uruchomić elektrownię.

MASZ JUŻ WSZYSTKIE DANE w wiadomości użytkownika! NIE POBIERAJ ich ponownie!

Oto dane które otrzymałeś:
- documentation: dokumentacja techniczna turbiny (PRZECZYTAJ JĄ - są tam zasady bezpieczeństwa!)
- weather: prognoza pogody
- turbinecheck: status turbiny
- powerplantcheck: wymagania elektrowni

Twoje zadanie (wykonaj po kolei):
1. Przeczytaj documentation - znajdź zasady:
   - jaka prędkość wiatru jest bezpieczna a jaka niebezpieczna
   - jaki pitchAngle i tryb dla jakich warunków
   
2. Przeanalizuj weather - znajdź timestampy:
   - z silnym wiatrem (które mogą uszkodzić turbinę) 
   - z odpowiednim wiatrem do produkcji

3. Wykonaj sekwencję (RÓWNOLEGLE gdzie możesz):
   a) unlockCodeGenerator dla każdej konfiguracji
   b) getResult aby pobrać unlock codes
   c) config z konfiguracjami
   d) turbinecheck
   e) done

WAŻNE: Masz już dane! NIE wywołuj start, get, help!`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "windpowerAPI",
      description: "Wywołaj API windpower. Buduj obiekt z 'action' i potrzebnymi parametrami.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", description: "Akcja do wywołania" },
          param: { type: "string", description: "Parametr dla 'get'" },
          startDate: { type: "string", description: "Data" },
          startHour: { type: "string", description: "Czas" },
          windMs: { type: "number", description: "Prędkość wiatru" },
          pitchAngle: { type: "number", description: "Kąt pitch (0, 45, 90)" },
          configs: { type: "object", description: "Konfiguracje dla action=config" },
        },
        required: ["action"],
      },
    },
  },
];

async function LLM(messages) {
  console.log("[LLM] Sending request, messages:", messages.length);
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        tools: TOOLS,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    console.log("[LLM] Response status:", response.status);

    if (!response.ok) {
      console.error("[LLM] Error:", response.status, await response.text());
      process.exit(1);
    }

    const text = await response.text();
    console.log("[LLM] Response text length:", text.length);
    
    const data = JSON.parse(text);
    console.log("[LLM] Parsed JSON, choices:", data.choices?.length);
    
    if (!data.choices || data.choices.length === 0) {
      console.error("[LLM] No choices:", data);
      process.exit(1);
    }
    
    const msg = data.choices[0].message;
    console.log("[LLM] Message:", msg);
    return msg;
  } catch (e) {
    clearTimeout(timeout);
    console.error("[LLM] Exception:", e.message);
    throw e;
  }
}

async function windpowerAPI(body) {
  const response = await fetch(`${AIDEVS_API_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: AIDEVS_KEY,
      task: "windpower",
      answer: body,
    }),
  });
  return response.json();
}

function simplifyWeather(weatherData) {
  if (!weatherData?.forecast) return [];
  return weatherData.forecast.map(f => ({
    timestamp: f.timestamp,
    windMs: f.windMs
  }));
}

function simplifyHelp(helpResult) {
  if (!helpResult?.actions) return helpResult;
  return { actions: helpResult.actions, notes: helpResult.notes };
}

async function main() {
  console.log("=== Step 1: Manual start and fetch data ===");
  
  await windpowerAPI({ action: "start" });
  console.log("Session started");

  const helpResult = await windpowerAPI({ action: "help" });
  console.log("Help fetched");

  const weatherReq = windpowerAPI({ action: "get", param: "weather" });
  const powerReq = windpowerAPI({ action: "get", param: "powerplantcheck" });
  const docReq = windpowerAPI({ action: "get", param: "documentation" });

  await Promise.all([weatherReq, powerReq, docReq]);

  const results = {};
  while (Object.keys(results).length < 3) {
    const result = await windpowerAPI({ action: "getResult" });
    if (result.code === 11) {
      await new Promise((r) => setTimeout(r, 50));
      continue;
    }
    const key = result.sourceFunction || "doc";
    results[key] = result;
    console.log(`Got ${key}`);
  }

  console.log("All data fetched");

  const simplifiedWeather = simplifyWeather(results.weather);
  const simplifiedHelp = simplifyHelp(helpResult);

  console.log("\n=== Step 2: Agent loop ===");
  console.log("Weather entries:", simplifiedWeather.length);
  console.log("Simplified payload size:", JSON.stringify(simplifiedWeather).length);

  const userMessage = "Oto dane z API:\n\n" +
    "help (dostepne akcje):\n" + JSON.stringify(simplifiedHelp) + "\n\n" +
    "documentation:\n" + JSON.stringify(results.doc || results.documentation) + "\n\n" +
    "weather (forecast):\n" + JSON.stringify(simplifiedWeather) + "\n\n" +
    "turbinecheck:\n" + JSON.stringify(results.turbinecheck) + "\n\n" +
    "powerplantcheck:\n" + JSON.stringify(results.powerplantcheck) + "\n\n" +
    "Przeanalizuj powyzsze dane i wykonaj zadanie.";

  console.log("User message length:", userMessage.length);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage }
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    console.log(`\n--- Iteration ${i + 1} ---`);

    const response = await LLM(messages);

    console.log("[LLM Response]:", JSON.stringify(response).substring(0, 500));

    if (!response.tool_calls || response.tool_calls.length === 0) {
      console.log("[Agent] No tool call");
      if (response.content) {
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: "Wywołaj odpowiednią akcję używając toola windpowerAPI." });
      }
      continue;
    }

    const toolCall = response.tool_calls[0];
    messages.push({ role: "assistant", tool_calls: [toolCall] });

    let args;
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      const fixed = toolCall.function.arguments.replace(/'/g, '"');
      try { args = JSON.parse(fixed); }
      catch (e2) {
        messages.push({ role: "assistant", content: toolCall.function.arguments });
        messages.push({ role: "user", content: "Błąd parsowania JSON. Użyj poprawnego formatu." });
        continue;
      }
    }

    console.log("[Agent] Calling:", JSON.stringify(args).substring(0, 200));

    try {
      const result = await windpowerAPI(args);
      console.log("[Agent] Result:", JSON.stringify(result).substring(0, 300));

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });

      if (result.code === 0 && result.message && result.message.includes("FLG:")) {
        console.log("\n🎉 SUCCESS! Flag:", result.message);
        return;
      }
    } catch (e) {
      console.error("[Agent] Error:", e);
    }
  }

  console.log("\n[ERROR] Max iterations reached");
}

await main();
