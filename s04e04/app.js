import fs from "fs";
import { OPENROUTER_KEY, AIDEVS_KEY, AIDEVS_API_URL } from "../config.js";

const MODEL = "openai/gpt-5-mini";

const systemPrompt = `Your task is to organize Natan's notes into a logical order.

Requirements(in polish):
- 3 katalogi: /miasta, /osoby, /towary
- W katalogu /miasta mają znaleźć się pliki o nazwach (w mianowniku) takich jak miasta opisywane przez Natana. W środku tych plików powinna być struktura JSON z towarami, jakie potrzebuje to miasto i ile tego potrzebuje (bez jednostek).
- W katalogu /osoby powinny być pliki z notatkami na temat osób, które odpowiadają za handel w miastach. Każdy plik powinien zawierać imię i nazwisko jednej osoby i link (w formacie markdown) do miasta, którym ta osoba zarządza.
- Nazwa pliku w /osoby nie ma znaczenia, ale jeśli nazwiesz plik tak jak dana osoba (z podkreśleniem zamiast spacji), a w środku dasz wymagany link, to system też rozpozna, o co chodzi.
- W katalogu /towary/ mają znajdować się pliki określające, które przedmioty są wystawione na sprzedaż. We wnętrzu każdego pliku powinien znajdować się link do miasta, które oferuje ten towar. Nazwa towaru to mianownik w liczbie pojedynczej, więc "koparka", a nie "koparki"

Plan:
1. Call the interactAPI tool with {action: "help"} to learn how the filesystem API works.
2. Read all the notes files with readFile tool. They are in polish language. Available files: README.md, rozmowy.txt, transakcje.txt, ogłoszenia.txt
3. Use interactAPI to organize the notes as described in the task.
4. Call {action:"done"} to verify.
5. If failed, call {action:"reset"} and start again at point 3.

Important:
- DO NOT use Polish characters in file names.
- DO NOT use Polish characters in JSON texts.
- You can send single instructions OR use batch_mode and send everything together - it's possible to create and organize entire filesystem in one request.
`;

const tools = [
  {
    type: "function",
    function: {
      name: "interactAPI",
      description:
        "Interact with the filesystem API. Use 'help' to discover available actions. Supports batch_mode with an array of actions.",
      parameters: {
        oneOf: [
          {
            type: "object",
            properties: {
              action: {
                type: "string",
                description: "The filesystem action to perform",
              },
            },
            required: ["action"],
            additionalProperties: true,
          },
          {
            type: "array",
            items: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  description: "The filesystem action to perform",
                },
              },
              required: ["action"],
              additionalProperties: true,
            },
          },
        ],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "readFile",
      description: "Read a chosen file by name.",
      parameters: {
        type: "object",
        properties: {
          fileName: {
            type: "string",
            description: "Name of the file to read (e.g., 'transakcje.txt')",
          },
        },
        required: ["fileName"],
      },
    },
  },
];

const handlers = {
  interactAPI: async function (params) {
    const response = await fetch(`${AIDEVS_API_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: AIDEVS_KEY,
        task: "filesystem",
        answer: params,
      }),
    });
    return response.json();
  },
  readFile: async function (params) {
    const filePath = `./natan_notes/${params.fileName}`;
    if (!fs.existsSync(filePath)) {
      return { error: "File not found" };
    }
    return { content: fs.readFileSync(filePath, "utf-8") };
  },
};

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
      tools: tools,
    }),
  });

  if (!response.ok) {
    console.error("LLM request failed:", response.status, await response.text());
    process.exit(1);
  }

  return response.json();
}

async function main() {
  const history = [];
  const maxIterations = 15;

  for (let i = 0; i < maxIterations; i++) {
    const agent = await LLM(history);
    const agentMsg = agent.choices[0].message;
    console.log("Agent:", agentMsg.content);

    if (agentMsg.tool_calls && agentMsg.tool_calls.length > 0) {
      history.push(agentMsg);
      for (const toolCall of agentMsg.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        console.log("Executing:", toolName, toolArgs);

        const result = await handlers[toolName](toolArgs);
        console.log("Result:", JSON.stringify(result));

        if (JSON.stringify(result).includes("FLG")) {
          console.log("MISSION COMPLETE!");
          console.log("Full result:", JSON.stringify(result));
          return;
        }

        history.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    } else {
      history.push({ role: "assistant", content: agentMsg.content });
    }
  }

  console.log("Max iterations reached - mission failed to complete");
}

main();
