import { OPENROUTER_KEY, AIDEVS_KEY, AIDEVS_API_URL } from "../config.js";

const MODEL = "openai/gpt-5-mini";
const systemPrompt = ``;

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
    }),
  });

  if (!response.ok) {
    console.error("LLM request failed:", response.status, await response.text());
    process.exit(1);
  }

  return response.json();
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

async function main() {
  console.log("=== Step 1: Get help ===");
  const helpResult = await windpowerAPI({ action: "help" });
  console.log("Help:", JSON.stringify(helpResult, null, 2));

  console.log("\n=== Step 2: Start service window ===");
  await windpowerAPI({ action: "start" });
  console.log("Service window started");

  console.log("\n=== Step 3: Request data (parallel) ===");
  const weatherReq = windpowerAPI({ action: "get", param: "weather" });
  const turbineReq = windpowerAPI({ action: "get", param: "turbinecheck" });
  const powerReq = windpowerAPI({ action: "get", param: "powerplantcheck" });
  const docReq = windpowerAPI({ action: "get", param: "documentation" });

  const [weather, turbine, power, documentation] = await Promise.all([weatherReq, turbineReq, powerReq, docReq]);

  console.log("Weather (queued):", JSON.stringify(weather, null, 2));
  console.log("TurbineCheck (queued):", JSON.stringify(turbine, null, 2));
  console.log("PowerPlantCheck (queued):", JSON.stringify(power, null, 2));
  console.log("Documentation:", JSON.stringify(documentation, null, 2));

  console.log("\n=== Step 4: Get queued results ===");
  const resultsMap = {};
  const needed = new Set(["weather", "turbinecheck", "powerplantcheck"]);
  const startTime = Date.now();

  while (needed.size > 0 && Date.now() - startTime < 25000) {
    const result = await windpowerAPI({ action: "getResult" });
    if (result.code === 11) {
      await new Promise((r) => setTimeout(r, 20));
      continue;
    }
    console.log("Got result:", result.sourceFunction, "code:", result.code);
    resultsMap[result.sourceFunction] = result;
    needed.delete(result.sourceFunction);
  }

  const weatherData = resultsMap.weather;
  const turbineData = resultsMap.turbinecheck;
  const powerPlantData = resultsMap.powerplantcheck;

  console.log("\n=== Weather Forecast ===");
  console.log(JSON.stringify(weatherData, null, 2));
  console.log("\n=== Turbine Status ===");
  console.log(JSON.stringify(turbineData, null, 2));
  console.log("\n=== Power Plant Requirements ===");
  console.log(JSON.stringify(powerPlantData, null, 2));

  console.log("\n=== Step 5: Generate unlock codes (parallel) ===");
  const forecast = weatherData.forecast;
  const configs = [];

  const stormTimestamps = forecast.filter((f) => f.windMs >= 14).map((f) => f.timestamp);
  const productionTimestamps = forecast.filter((f) => f.windMs >= 4 && f.windMs < 14).map((f) => f.timestamp);

  console.log("Storm timestamps:", stormTimestamps);
  console.log("Production timestamps:", productionTimestamps.slice(0, 10));

  for (const f of forecast) {
    const timestamp = f.timestamp;
    const windMs = f.windMs;

    if (windMs >= 14) {
      if (configs.filter((c) => c.mode === "idle").length < 3) {
        configs.push({ timestamp, windMs, pitchAngle: 90, mode: "idle" });
      }
    } else if (windMs >= 4 && configs.filter((c) => c.mode === "production").length < 1) {
      configs.push({ timestamp, windMs, pitchAngle: 0, mode: "production" });
    }
  }

  console.log("Configs to generate:", configs.length);
  console.log("Configs:", configs);

  console.log("Configs to generate:", configs.length);
  console.log("Sample configs:", configs.slice(0, 5));

  const unlockPromises = configs.map((c) =>
    windpowerAPI({
      action: "unlockCodeGenerator",
      startDate: c.timestamp.split(" ")[0],
      startHour: c.timestamp.split(" ")[1],
      windMs: c.windMs,
      pitchAngle: c.pitchAngle,
    }),
  );

  await Promise.all(unlockPromises);
  console.log("Unlock codes requested, now collect them...");

  const unlockCodesMap = {};
  const unlockStartTime = Date.now();
  const neededUnlockCodes = configs.length;

  console.log("Waiting for", neededUnlockCodes, "unlock codes...");

  let attempt = 0;
  while (Object.keys(unlockCodesMap).length < neededUnlockCodes && Date.now() - unlockStartTime < 15000) {
    attempt++;
    const result = await windpowerAPI({ action: "getResult" });
    if (result.code === 11) {
      await new Promise((r) => setTimeout(r, 50));
      continue;
    }
    if (result.unlockCode && result.signedParams) {
      console.log("Got unlock code for:", result.signedParams);
      const key = `${result.signedParams.startDate} ${result.signedParams.startHour}`;
      unlockCodesMap[key] = result.unlockCode;
    } else if (result.unlockCode) {
      console.log("Got unlock code but no signedParams:", result);
    } else {
      console.log(
        "Skipping non-unlock result, code:",
        result.code,
        "source:",
        result.sourceFunction,
        "msg:",
        result.message?.substring(0, 50),
      );
    }
  }

  console.log("Got unlock codes:", Object.keys(unlockCodesMap).length, "of", neededUnlockCodes);
  console.log("Unlock codes map:", unlockCodesMap);

  console.log("\n=== Step 6: Send configuration ===");
  const configPayload = {};

  for (const c of configs) {
    const key = c.timestamp;
    const unlockCode = unlockCodesMap[key];
    if (unlockCode) {
      configPayload[key] = {
        pitchAngle: c.pitchAngle,
        turbineMode: c.mode,
        unlockCode: unlockCode,
      };
    }
  }

  console.log("Sending config with", Object.keys(configPayload).length, "entries");
  const configResult = await windpowerAPI({
    action: "config",
    configs: configPayload,
  });
  console.log("Config result:", JSON.stringify(configResult, null, 2));

  console.log("\n=== Step 7: Turbine check ===");
  const turbineCheckResult = await windpowerAPI({ action: "get", param: "turbinecheck" });
  console.log("Turbine check requested");

  let finalTurbineResult;
  for (let i = 0; i < 20; i++) {
    const result = await windpowerAPI({ action: "getResult" });
    if (result.code !== 11) {
      finalTurbineResult = result;
      break;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  console.log("Turbine check result:", JSON.stringify(finalTurbineResult, null, 2));

  console.log("\n=== Step 8: Done ===");
  const doneResult = await windpowerAPI({ action: "done" });
  console.log("Done result:", JSON.stringify(doneResult, null, 2));
}

await main();
