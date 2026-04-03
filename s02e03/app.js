import { OPENROUTER_KEY, AIDEVS_KEY } from "../config.js";

const systemPrompt = `Your job is to shorten log report that user will deliver from power plant system.
Shorten descriptions aggressively to be more concise.
Strong compression is needed.
Each description should be max 5-6 words.
Each line: [YYYY-MM-DD HH:MM] [SEVERITY] COMPONENT description
Do not remove components written in uppercase when doing rephrasing, FIRMWARE is also considered a component.
Make sure to make FIRMWARE descriptions understandable. They are critical.
Do not remove or shorten final FIRMWARE message.

Shortening examples:
"failed recovery step. Subsystem in degraded mode." > "Failed recovery. Sybsystem degraded.".
"Recovery attempts limited." > "Recovery limited."
"critical boundary exceeded." > "critical boundary". Words like exceeded can be omitted.

Make sure you keep chronological order of events (sorted by timestamp).
Return ONLY processed log content, any extra comments are not needed.`;

const getLogs = async function () {
  const response = await fetch(
    `/data/${AIDEVS_KEY}/failure.log`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/text",
      },
    },
  );
  const rawLogs = await response.text();
  const lines = rawLogs.split("\n").filter((l) => l.length > 0);
  const filteredLogs = lines.filter((line) => !line.includes("[INFO]"));
  console.log("Logs without [INFO]: " + filteredLogs.length);
  const seen = new Set();
  const uniqueLogs = filteredLogs.filter((line) => {
    const timestampEnd = line.indexOf("] ", line.indexOf("[") + 1);
    const msgStart = timestampEnd + 2;
    const message = line.slice(msgStart);
    if (seen.has(message)) return false;
    seen.add(message);
    return true;
  });
  console.log("Logs without duplicates: " + uniqueLogs.length);
  return uniqueLogs.join("\n");
};

const verify = async function (logs) {
  const response = await fetch("/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apikey: AIDEVS_KEY,
      task: "failure",
      answer: {
        logs: logs,
      },
    }),
  });

  const answer = await response.json();
  return answer;
};

const LLM = async function (logs) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost",
        "X-Title": "AIDEVS",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: logs },
        ],
      }),
    },
  );

  const data = await response.json();
  return data.choices[0].message.content;
};

const main = async function () {
  const logs = await getLogs();
  console.log("=".repeat(50));
  console.log(logs);
  console.log("=".repeat(50));
  const res = await LLM(logs);
  console.log("=".repeat(50));
  console.log(res);
  console.log("=".repeat(50));
  const answer = await verify(res);
  console.log("ANSWER:");
  console.log(answer);
};

main();
