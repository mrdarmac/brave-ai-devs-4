import fs from "fs/promises";

import { OPENROUTER_KEY, AIDEVS_KEY, AIDEVS_API_URL } from "../config.js";
if (!OPENROUTER_KEY) {
  console.error("Error: API_KEY environment variable not set");
  process.exit(1);
}

const functionSchemas = [
  {
    name: "get_locations",
    description:
      "Get a list of locations (coordinates) where the suspect was seen.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Suspect's name." },
        surname: { type: "string", description: "Suspect's surname." },
      },
      required: ["name", "surname"],
    },
  },
  {
    name: "calculate_distances",
    description:
      "Calculate the distances between suspect's coordinates and power plant coordinates",
    parameters: {
      type: "object",
      properties: {
        suspectCoordinates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              latitude: { type: "number" },
              longitude: { type: "number" },
            },
            required: ["latitude", "longitude"],
          },
        },
        powerPlantsCoordinates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              code: { type: "string" },
              coords: { type: "array", items: { type: "number" } },
            },
            required: ["code", "coords"],
          },
        },
      },
      required: ["suspectCoordinates", "powerPlantsCoordinates"],
    },
  },
  {
    name: "check_access_level",
    description: "Check the access level of the suspect.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Suspect's name." },
        surname: { type: "string", description: "Suspect's surname." },
        birthYear: { type: "integer", description: "Suspect's birth year." },
      },
      required: ["name", "surname", "birthYear"],
    },
  },
];

const handlers = {
  async get_locations(name, surname) {
    const response = await fetch(`${AIDEVS_API_URL}/api/location`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apikey: AIDEVS_KEY,
        name,
        surname,
      }),
    });

    return await response.json();
  },
  async calculate_distances(suspectCoords, powerPlants) {
    function haversine(lat1, lon1, lat2, lon2) {
      const R = 6371; // Earth's radius in km
      const toRad = (deg) => (deg * Math.PI) / 180;

      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);

      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c; // Distance in km
    }

    for (const s of suspectCoords) {
      for (const pp of powerPlants) {
        const dist = haversine(
          s.latitude,
          s.longitude,
          pp.coords[0],
          pp.coords[1],
        );
        if (dist < 1) {
          return {
            role: "system",
            message: `Correct suspect! Check access level and return correct answer. Power plant code: ${pp.code}!`,
          };
        }
      }
    }
    return { role: "system", message: "Incorrect suspect." };
  },
  async check_access_level(name, surname, birthYear) {
    const response = await fetch(`${AIDEVS_API_URL}/api/accesslevel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apikey: AIDEVS_KEY,
        name,
        surname,
        birthYear,
      }),
    });

    return await response.json();
  },
};

async function runAgent(suspects, powerPlants) {
  const systemPrompt = `You are an investigative analysis agent. Your job is to identify which suspect was near a power plant by using the tools available to you.

## Data

Suspects: ${JSON.stringify(suspects)}

Power Plants: ${JSON.stringify(powerPlants)}

## Tools Available

- get_locations(name, surname): Get a list of locations where the suspect was seen.

- calculate_distances(suspectCoords, powerPlantData): Calculate the distances. This will return 'Correct suspect!' with more instructions or 'Incorrect suspect'.

- check_access_level(name): Get suspect's access level.

## Task

Loop through each suspect and follow these steps:

1. Call get_locations() to get the suspect's coordinates.

2. Call calculate_distances() using the suspect's coordinates and the power plant's data.

3. If calculate_distances returns "Correct suspect!":

   a. Call check_access_level() for that suspect.

   b. Record the power plant's code.

   c. Return a JSON object in this exact format:

      {

        "name": "<first name>",

        "surname": "<last name>",

        "accessLevel": "<access level>",

        "powerPlantCode": "<plant code>"

      }

4. If no correct suspect is found, return null.

## Rules

- You must use tool calls to retrieve data. Do not guess or invent values.

- Maximum of 30 tool call iterations total. Be efficient.

- Stop and return as soon as you find the first correct suspect.

- Return only the final JSON object (or null). No explanation needed.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: "Find the suspect near a power plant." },
  ];

  let iterations = 0;
  const maxIterations = 30;

  while (iterations < maxIterations) {
    iterations++;

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost",
          "X-Title": "Suspect Tracker",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          tools: functionSchemas.map((s) => ({
            type: "function",
            function: s,
          })),
        }),
      },
    );

    const data = await response.json();
    const assistantMessage = data.choices[0].message;
    messages.push(assistantMessage);

    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      try {
        return JSON.parse(assistantMessage.content);
      } catch {
        return assistantMessage.content;
      }
    }

    for (const toolCall of assistantMessage.tool_calls) {
      const { name, arguments: args } = toolCall.function;
      const parsedArgs = JSON.parse(args);

      let result;
      if (name === "get_locations") {
        result = await handlers.get_locations(
          parsedArgs.name,
          parsedArgs.surname,
        );
      } else if (name === "calculate_distances") {
        result = await handlers.calculate_distances(
          parsedArgs.suspectCoordinates,
          parsedArgs.powerPlantsCoordinates,
        );
      } else if (name === "check_access_level") {
        result = await handlers.check_access_level(
          parsedArgs.name,
          parsedArgs.surname,
          parseInt(parsedArgs.birthYear),
        );
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  return null;
}

async function main() {
  // 1. Load suspects.json
  const suspects = await fs
    .readFile("./suspects.json", "utf8")
    .then((data) => JSON.parse(data))
    .then((data) =>
      data.map(({ name, surname, born }) => ({ name, surname, born })),
    );

  // 2. Load findhim_locations.json
  const powerPlants = await fetch(
    `${AIDEVS_API_URL}/data/${AIDEVS_KEY}/findhim_locations.json`,
  )
    .then((res) => res.json())
    .then((data) => {
      const powerPlantsCoordinates = [
        { latitude: 50.3249, longitude: 18.7857 },
        { latitude: 51.4058, longitude: 19.7028 },
        { latitude: 53.4836, longitude: 18.7536 },
        { latitude: 53.7781, longitude: 18.7998 },
        { latitude: 51.4027, longitude: 21.1471 },
        { latitude: 53.3486, longitude: 18.4247 },
        { latitude: 54.6167, longitude: 18.1667 },
      ];
      Object.keys(data.power_plants).forEach(
        (p, i) => (data.power_plants[p].coords = powerPlantsCoordinates[i]),
      );
      return Object.values(data.power_plants).map(({ code, coords }) => ({
        code,
        coords: [coords.latitude, coords.longitude],
      }));
    })
    .catch((err) => {
      console.error("Error:", err.message);
      process.exit(1);
    });
  const result = await runAgent(suspects, powerPlants);
  console.log(JSON.stringify(result));
}

main().catch(console.error);
