import { OPENROUTER_KEY, AIDEVS_KEY, AIDEVS_API_URL } from "../config.js";
import fs from "fs";
import csvParser from "csv-parser";
if (!OPENROUTER_KEY) {
  console.error("Error: API_KEY environment variable not set");
  process.exit(1);
}

let filteredData = [];
let filteredJobOnly = [];
let people = [];

const apiCall = async function (inputArray, systemPrompt) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4.5",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: JSON.stringify(inputArray),
          },
        ],
      }),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    console.error("API Error:", data);
    return;
  }

  if (!data.choices || !data.choices[0]) {
    console.error("Invalid response structure:", data);
    return;
  }

  const raw = data.choices[0].message.content
    .replace(/```json|```/g, "")
    .trim();
  let content;
  try {
    content = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse LLM response:", e);
    return;
  }
  return content;
};

(async () => {
  try {
    console.log("1. Filtruję...");

    await new Promise((resolve, _reject) => {
      fs.createReadStream("people.csv")
        .pipe(csvParser())
        .on("data", (person) => {
          if (
            person.gender === "M" &&
            person.birthDate > "1986" &&
            person.birthDate < "2006" &&
            person.birthPlace === "Grudziądz"
          ) {
            filteredData.push(person);
            filteredJobOnly.push(person.job);
          }
        })
        .on("end", () => {
          filteredData.forEach((x) => {
            people.push({
              name: x.name,
              surname: x.surname,
              gender: x.gender,
              born: x.birthDate.slice(0, 4),
              city: x.birthPlace,
            });
          });
          console.log(people[0]);

          console.log(`2. Znaleziono ${filteredData.length} osób...`);
          console.log(filteredJobOnly);
          console.log(`Ilość opisów pracy: ${filteredJobOnly.length}`);

          resolve();
        });
    });
    // ZAPYTANIE DO LLM
    const systemPrompt = `Input: JSON array of strings. Number of strings: ${filteredJobOnly.length}. Each string describes a person's job.
      Available tags:    
      - IT — software development, programming, systems administration, networking, cybersecurity, data science
      - transport — logistics, delivery, shipping, freight, supply chain
      - edukacja — teaching, tutoring, coaching, lecturing, academic work
      - medycyna — healthcare, nursing, doctoring
      - praca z ludźmi — direct interaction with clients, patients, students, customers
      - praca z pojazdami — driving, operating, maintaining or repairing any type of vehicle
      - praca fizyczna — manual labor, construction
      Your task:
      Loop over the input array. In a new, empty array assign one or more tags to each string as an inner array.
      You can use ONLY the tags provided. If none of the tags really fits the string then assign an empty array!
      Like this: [[TAGS FOR STRING1], [TAGS FOR STRING2], [TAGS FOR STRING3]]
      Return the new array as JSON.`;
    console.log("3. Wysyłam zapytanie do LLM...");
    const tags = await apiCall(filteredJobOnly, systemPrompt);
    if (!tags) {
      console.error("Failed to get tags from API");
      return;
    }
    console.log(tags);
    console.log(tags.length);

    // WYNIK I POŁACZENIE TAGÓW Z OSOBAMI
    people.forEach((p, i) => {
      p.tags = tags?.[i] || [];
    });

    const answer = people.filter((person) => person.tags.includes("transport"));
    console.log("ANSWER:");
    console.log(answer);
    console.log("Answer saved to answer.json");
    fs.writeFileSync("answer.json", JSON.stringify(answer, null, 2));

    // WYSŁANIE WYNIKU I ODCZYTANIE FLAGI

    const res = await fetch(`${AIDEVS_API_URL}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apikey: AIDEVS_KEY,
        task: "people",
        answer: answer,
      }),
    });

    const flaga = await res.json();
    console.log("FLAGA TO:");
    console.log(flaga);
  } catch (e) {
    console.error("Fatal error:", e);
    process.exit(1);
  }
})();
