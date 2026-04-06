import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { OPENROUTER_KEY } from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");

let citiesMap = new Map();
let itemsMap = new Map();
let connectionsMap = new Map();

function loadCSVs() {
  const citiesData = fs.readFileSync(
    path.join(DATA_DIR, "cities.csv"),
    "utf-8",
  );
  const itemsData = fs.readFileSync(path.join(DATA_DIR, "items.csv"), "utf-8");
  const connectionsData = fs.readFileSync(
    path.join(DATA_DIR, "connections.csv"),
    "utf-8",
  );

  for (const line of citiesData.split("\n").slice(1)) {
    const [name, code] = line.split(",");
    if (name && code) citiesMap.set(code.trim(), name.trim());
  }

  for (const line of itemsData.split("\n").slice(1)) {
    const [name, code] = line.split(",");
    if (name && code) itemsMap.set(code.trim(), name.trim());
  }

  for (const line of connectionsData.split("\n").slice(1)) {
    const [itemCode, cityCode] = line.split(",");
    if (itemCode && cityCode) {
      const city = cityCode.trim();
      if (!connectionsMap.has(city)) connectionsMap.set(city, []);
      connectionsMap.get(city).push(itemCode.trim());
    }
  }

  console.log(`Loaded ${citiesMap.size} cities, ${itemsMap.size} items`);
}

async function parseNaturalLanguage(query) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        messages: [
          {
            role: "user",
            content: `Z podanego tekstu wypisz nazwę przedmiotu wraz z kluczowymi parametrami technicznymi (napięcie, moc, pojemność itp.). Zachowaj wszystkie istotne specyfikacje. Nie dodawaj żadnego dodatkowego tekstu, komentarzy ani cudzysłowów.\nTekst: "${query}"`,
          },
        ],
        max_tokens: 50,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

function findItemCode(query) {
  const queryWords = query.toLowerCase().split(/[\s\n]+/).filter(w => w.length > 0);
  
  for (const [code, name] of itemsMap) {
    const itemWords = name.toLowerCase().split(/[\s\n]+/).filter(w => w.length > 0);
    const allMatch = queryWords.every(word => itemWords.includes(word));
    if (allMatch) {
      console.log(`Matched: "${name}"`);
      return code;
    }
  }
  return null;
}

function findCitiesWithItem(itemCode) {
  const cities = [];
  for (const [cityCode, itemCodes] of connectionsMap) {
    if (itemCodes.includes(itemCode)) {
      const cityName = citiesMap.get(cityCode);
      if (cityName) cities.push(cityName);
    }
  }
  return cities;
}

async function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "POST" && req.url === "/findItem") {
    try {
      const { params } = await parseRequestBody(req);

      const itemName = await parseNaturalLanguage(params);
      console.log(`Parsed item: "${itemName}" from query: "${params}"`);

      const itemCode = findItemCode(itemName);

      if (!itemCode) {
        res.end(JSON.stringify({ output: "Nie znaleziono przedmiotu" }));
        return;
      }

      const cities = findCitiesWithItem(itemCode);
      const output =
        cities.length > 0
          ? cities.join(", ")
          : "Brak miast oferujących ten przedmiot";

      const response = JSON.stringify({ output });
      console.log(`Response size: ${Buffer.byteLength(response)} bytes`);

      res.end(response);
    } catch (error) {
      console.error("Error:", error.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ output: "Blad serwera" }));
    }
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

loadCSVs();

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default server;
