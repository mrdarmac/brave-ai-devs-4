import { OPENROUTER_KEY, AIDEVS_KEY } from "../config.js";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SENSORS_DIR = join(__dirname, "sensors");

const SENSOR_TYPE_MAP = {
  temperature: "temperature_K",
  pressure: "pressure_bar",
  water: "water_level_meters",
  voltage: "voltage_supply_v",
  humidity: "humidity_percent",
};

const VALID_RANGES = {
  temperature_K: { min: 553, max: 873 },
  pressure_bar: { min: 60, max: 160 },
  water_level_meters: { min: 5.0, max: 15.0 },
  voltage_supply_v: { min: 229.0, max: 231.0 },
  humidity_percent: { min: 40.0, max: 80.0 },
};

const LLM_BATCH_COUNT = 4;

function getAllowedFields(sensorType) {
  const parts = sensorType.split("/");
  const allowed = [];
  for (const part of parts) {
    if (SENSOR_TYPE_MAP[part]) {
      allowed.push(SENSOR_TYPE_MAP[part]);
    }
  }
  return allowed;
}

function isAnomaly(sensor, allowedFields) {
  for (const [field, range] of Object.entries(VALID_RANGES)) {
    const value = sensor[field];
    if (value !== 0) {
      if (!allowedFields.includes(field)) {
        return true;
      }
      if (value < range.min || value > range.max) {
        return true;
      }
    }
  }
  return false;
}

async function readSensorFiles(processFn) {
  for (let batchStart = 1; batchStart <= 9999; batchStart += 100) {
    const batchEnd = Math.min(batchStart + 99, 9999);
    const promises = [];

    for (let i = batchStart; i <= batchEnd; i++) {
      const filename = String(i).padStart(4, "0");
      promises.push(
        readFile(join(SENSORS_DIR, `${filename}.json`), "utf-8")
          .then((content) => ({ filename, content }))
          .catch(() => null),
      );
    }

    const results = await Promise.all(promises);

    for (const result of results) {
      if (!result) continue;
      try {
        const sensor = JSON.parse(result.content);
        sensor.filename = result.filename;
        await processFn(sensor);
      } catch {
        continue;
      }
    }
  }
}

async function findAnomalies() {
  const anomalies = [];

  await readSensorFiles((sensor) => {
    const allowedFields = getAllowedFields(sensor.sensor_type);
    if (isAnomaly(sensor, allowedFields)) {
      anomalies.push(sensor.filename);
    }
  });

  return anomalies;
}

async function findNoteBasedAnomalies(anomalies, negativeNotes) {
  const anomalySet = new Set(anomalies);
  const noteBasedAnomalies = [];

  await readSensorFiles((sensor) => {
    if (anomalySet.has(sensor.filename)) return;

    if (
      negativeNotes.some((neg) =>
        sensor.operator_notes.toLowerCase().includes(neg.toLowerCase()),
      )
    ) {
      noteBasedAnomalies.push(sensor.filename);
    }
  });

  return noteBasedAnomalies;
}

async function getUniqueOperatorNotes() {
  const notes = new Set();

  await readSensorFiles((sensor) => {
    const parts = sensor.operator_notes.split(",");
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed !== "") {
        notes.add(trimmed);
      }
    }
  });

  return [...notes];
}

async function LLM(notes) {
  const systemPrompt = `You will receive an array of operator notes from sensor anomaly reports.
Analyze each note and return ONLY the notes that suggest anything negative or concerning about the sensor/system state.

Guidelines:
- If a note implies something needs attention, investigation, or is not normal - include it
- If a note describes an action being taken (audit, inspection, escalation, replacement, maintenance) - include it
- If a note expresses uncertainty, doubt, or concern about data quality - include it
- If a note describes a healthy, stable, or normal state - exclude it

Be inclusive rather than exclusive. When in doubt, include the note.
Return ONLY a raw JSON array. No code blocks, no markdown formatting, no explanations.`;

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(notes) },
        ],
      }),
    },
  );

  const data = await response.json();
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch (e) {
    console.error("Failed to parse LLM response:", e.message);
    console.log("Raw response:", data.choices[0].message.content);
    return [];
  }
}

async function getAllNegativeNotes(uniqueNotes) {
  const BATCH_SIZE = Math.ceil(uniqueNotes.length / LLM_BATCH_COUNT);
  const batches = [];

  for (let i = 0; i < LLM_BATCH_COUNT; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, uniqueNotes.length);
    batches.push(uniqueNotes.slice(start, end));
  }

  const results = await Promise.all(batches.map((batch) => LLM(batch)));
  return [...new Set(results.flat())];
}

async function verify(notes) {
  const response = await fetch("/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: AIDEVS_KEY,
      task: "evaluation",
      answer: { recheck: notes },
    }),
  });

  return response.json();
}

async function main() {
  const anomalies = await findAnomalies();
  console.log(`Found ${anomalies.length} anomalies with wrong values.`);

  const uniqueNotes = await getUniqueOperatorNotes();
  console.log(`Found ${uniqueNotes.length} unique notes from all sensors`);

  const negativeNotes = await getAllNegativeNotes(uniqueNotes);
  console.log(`Found ${negativeNotes.length} negative notes.`);

  const noteBasedAnomalies = await findNoteBasedAnomalies(
    anomalies,
    negativeNotes,
  );
  console.log(`Found ${noteBasedAnomalies.length} note-based anomalies.`);

  const allAnomalies = [...new Set([...anomalies, ...noteBasedAnomalies])];
  console.log(`Total anomalies: ${allAnomalies.length}`);
  console.log(allAnomalies);

  const answer = await verify(allAnomalies);
  console.log(answer);
}

main();
