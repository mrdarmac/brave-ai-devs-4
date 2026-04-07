import tools from "./tools.js";
import handlers from "./handlers.js";
import { OPENROUTER_KEY, AIDEVS_KEY, AIDEVS_API_URL } from "../config.js";

const history = [];

const systemPrompt = `
Musisz poprawnie wypełnić deklarację transportu w Systemie Przesyłek Konduktorskich.
Musisz tak spreparować dane, aby była to przesyłka darmowa lub opłacana przez sam "System".
Dane niezbędne do wypełnienia deklaracji:
Nadawca (identyfikator): 450202122,
Punkt nadawczy: Gdańsk,
Punkt docelowy: Żarnowiec,
Waga: 2,8 tony (2800 kg),
Budżet: 0 PP (przesyłka ma być darmowa lub finansowana przez System),
Zawartość: kasety z paliwem do reaktora,
Uwagi specjalne: brak.
Zacznij od pobrania pliku index.md. To główny plik dokumentacji - zawiera odniesienia do innych plików.
Ustal prawidłowy kod trasy - trasa Gdańsk - Żarnowiec wymaga sprawdzenia sieci połączeń i listy tras. Nie przejmuj się, że trasa, którą chcemy jechać jest zamknięta, po prostu znajdź jej kod.  
Oblicz lub ustal opłatę - regulamin SPK zawiera tabelę opłat. Opłata zależy od kategorii przesyłki, jej wagi i przebiegu trasy.
Na podstawie wagi oblicz ile dodatkowych wagonów trzeba użyć. Jeśli tak to wypełnij to w odpowiednim polu deklaracji.
Budżet wynosi 0 PP - zwróć uwagę, które kategorie przesyłek są finansowane przez System.
Na sam koniec ściągnij wzór deklaracji i poprawnie go wypełnij(nie dodawaj żadnych komentarzy). Zwróć deklarację bez żadnych dodatkowych komentarzy.
`;

const verify = async function (declaration) {
  const response = await fetch(`${AIDEVS_API_URL}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apikey: AIDEVS_KEY,
      task: "sendit",
      answer: {
        declaration: declaration,
      },
    }),
  });

  const answer = await response.json();
  console.log(answer);
};

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
        model: "openai/gpt-5-mini",
        messages: messages,
        tools: tools,
        tool_choice: "auto",
      }),
    },
  );

  const data = await response.json();
  return data;
};

const agent = async function () {
  const MAX_ITERATIONS = 10;
  const history = [{ role: "system", content: systemPrompt }];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await callLLM(history, tools);
    const message = response.choices[0].message;

    if (!message.tool_calls) {
      return message.content;
    }

    history.push(message);

    for (const toolCall of message.tool_calls) {
      const toolName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);

      console.log(`[TOOL CALL] ${toolName}:`, args);

      let result;
      if (toolName === "getContent") {
        result = await handlers.getContent(args.documentName);
      }

      history.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: String(result),
      });
    }
  }

  return "Max iterations reached";
};

// TESTING
// const result = await agent();
// console.log(result);

const result = `SYSTEM PRZESYŁEK KONDUKTORSKICH - DEKLARACJA ZAWARTOŚCI
======================================================
DATA: 2026-03-18
PUNKT NADAWCZY: Gdańsk
------------------------------------------------------
NADAWCA: 450202122
PUNKT DOCELOWY: Żarnowiec
TRASA: X-01
------------------------------------------------------
KATEGORIA PRZESYŁKI: A
------------------------------------------------------
OPIS ZAWARTOŚCI (max 200 znaków): Kasety z paliwem do reaktora
------------------------------------------------------
DEKLAROWANA MASA (kg): 2800
------------------------------------------------------
WDP: 4
------------------------------------------------------
UWAGI SPECJALNE: brak
------------------------------------------------------
KWOTA DO ZAPŁATY: 0 PP
------------------------------------------------------
OŚWIADCZAM, ŻE PODANE INFORMACJE SĄ PRAWDZIWE.
BIORĘ NA SIEBIE KONSEKWENCJĘ ZA FAŁSZYWE OŚWIADCZENIE.
======================================================`;
const finalResult = verify(result);
