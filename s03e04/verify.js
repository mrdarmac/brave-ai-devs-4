import { AIDEVS_KEY, AIDEVS_API_URL } from "../config.js";
async function verify(serverURL) {
  const response = await fetch(`${AIDEVS_API_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: AIDEVS_KEY,
      task: "negotiations",
      answer: {
        tools: [
          {
            URL: serverURL,
            description:
              "Znajduje miasta oferujące dany przedmiot. Parametr 'params' przyjmuje zapytanie w języku naturalnym (np. 'potrzebuję rezystor 10 ohm'). Zwraca nazwy miast oddzielone przecinkami w polu 'output'.",
          },
        ],
      },
    }),
  });

  return response.json();
}

async function check() {
  const response = await fetch(`${AIDEVS_API_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: AIDEVS_KEY,
      task: "negotiations",
      answer: {
        action: "check",
      },
    }),
  });

  return response.json();
}

verify("server url here");

await new Promise((resolve) => setTimeout(resolve, 45000));

const c = await check();
console.log(c);
