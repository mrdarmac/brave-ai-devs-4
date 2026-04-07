import { AIDEVS_KEY, AIDEVS_API_URL } from "../config.js";

const downloadCSV = async function () {
  const url = `${AIDEVS_API_URL}/data/${AIDEVS_KEY}/categorize.csv`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch: ${response.status} ${response.statusText}`,
    );
  }
  const data = await response.text();

  const [headerRow, ...rows] = data.trim().split("\n");
  const headers = headerRow.split(",");

  return rows.map((row) => {
    const [code, description] = row.split(/,(?=")/); // split on comma before a quote
    return {
      code,
      description: description.replace(/"/g, "").trim(),
    };
  });
};

const verify = async function (prompt) {
  const response = await fetch(`${AIDEVS_API_URL}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apikey: AIDEVS_KEY,
      task: "categorize",
      answer: {
        prompt: prompt,
      },
    }),
  });

  const answer = await response.json();
  return answer;
};

const reset = async function () {
  const res = await verify("reset");
  return res;
};

const run = async function () {
  console.log("Resetting.");
  const r = await reset();
  console.log(reset);
  console.log("==========");
  console.log("Downloading data.");
  const data = await downloadCSV();
  console.log("Data downloaded.");
  console.log("==========");
  console.log("Checking...");
  for (const item of data) {
    const id = item.code;
    const desc = item.description;
    const prompt = `Classify item as Neutral(broken and old parts, electronics) or Dangerous(weapons). Reaktor always NEU. Return DNG/NEU. 
    ${id} ${desc}`;
    const answer = await verify(prompt);
    console.log(desc);
    console.log(answer);
  }
};

const test = await run();
console.log(test);
