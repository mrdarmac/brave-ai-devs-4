import tools from "./tools.js";
import handlers from "./handlers.js";
import { OPENROUTER_KEY } from "../config.js";

const MODEL = "google/gemini-3.1-flash-lite-preview";

const systemPrompt = `
You are an autonomous agent tasked with diagnosing and running a driver software on a restricted Linux virtual machine.

## YOUR GOAL
Run the binary at /opt/firmware/cooler/cooler.bin correctly. When it runs successfully, it will display a code in the format:
ECCS-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Capture this code and send it to the hub.

## TOOLS AVAILABLE
You have two tools:
- shellAPI: Execute a single shell command on the virtual machine
- verify: Send the discovered code to the hub

## CRITICAL: HOW TO EXECUTE BINARIES
- To RUN a binary file (like cooler.bin), use its FULL PATH as a command: /opt/firmware/cooler/cooler.bin <arguments>
  
- Do NOT use cat on binary files or executable files — this will read raw binary content and cause problems
- The cat command is ONLY for reading text files like settings.ini, .gitignore, .txt files, etc.
- If you see a .bin, .exe, or executable file, EXECUTE it directly, don't read it

## HOW TO APPROACH THIS TASK
Work sequentially, one shell command at a time. Plan before acting.

1. Start with "help" — this VM has a non-standard command set. Do not assume standard Linux commands are available. Always run "help" first to discover what commands exist.
2. Run the binary — execute /opt/firmware/cooler/cooler.bin <password> directly. 
   DO NOT use cat on the binary file — use the full path as a shell command.
3. Find the password — it is stored in multiple locations on the filesystem. Search for it.
4. Reconfigure if needed — there is a settings.ini file associated with the software. Editing files works differently on this system (non-standard). Discover how to edit files using "help", then modify settings to make the software run correctly.
5. Reboot if necessary — if you believe you have broken the system state, use the reboot function to restore and start over.

## SECURITY RULES — STRICTLY FOLLOW THESE
- You operate as a regular (non-root) user.
- Do NOT access or inspect the following directories: /etc, /root, /proc/
- If you find a .gitignore file in any directory, read it and respect it — do not touch any files or directories listed in it.
- Violating these rules will result in a temporary API ban and a VM reset.

## ERROR HANDLING
- The shell API may return error codes instead of results (e.g., rate limit, 503, ban).
- If you receive such an error, wait and retry. Do not panic or loop blindly.

## GENERAL PRINCIPLES
- Adapt to unexpected outputs — the environment is non-standard.
- Never assume. Observe → reason → act.
- Do not repeat failed commands without changing your approach.
`;

async function LLM(messages) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools,
      }),
    },
  );

  if (!response.ok) {
    console.error(
      "LLM request failed:",
      response.status,
      await response.text(),
    );
    process.exit(1);
  }

  return response.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function summarizeShellResult(result) {
  const data = Array.isArray(result.data)
    ? result.data.join(", ")
    : result.data;

  const summaries = {
    100: "Reboot successful",
    120: `ls ${result.path}: ${data}`,
    150: `cat ${result.path}: ${data}`,
    160: `Removed: ${result.path}`,
    181: `Line updated in ${result.path}: ${data}`,
    190: `help: ${data}`,
    193: `Found: ${data}`,
    195: `cooler.bin: ${data}`,
  };

  if (result.code < 0) return `Error ${result.code}: ${result.message}`;
  return summaries[result.code] ?? JSON.stringify(result);
}

async function executeTool(name, args) {
  if (name === "shellAPI") {
    const result = await handlers.shellAPI(args.cmd);
    if (result.code === -733 || result.code === -735) {
      const ttl = result.ban?.ttl_seconds ?? result.ban?.seconds_left;
      console.log(`  Banned for ${ttl}s - waiting...`);
      await sleep(ttl * 1000);
    } else if (result.code === -9999) {
      console.log("  Rate limited - waiting 5s...");
      await sleep(5000);
    }
    return result;
  }
  return handlers.verify(args.code);
}

async function main() {
  const messages = [];
  const maxIterations = 30;

  for (let i = 0; i < maxIterations; i++) {
    console.log(`\n=== Iteration ${i + 1}/${maxIterations} ===`);

    const message = (await LLM(messages)).choices[0].message;
    console.log("LLM:", message.content || "(no content)");

    if (!message.tool_calls?.length) {
      console.log("No tool calls - done.");
      break;
    }

    for (const toolCall of message.tool_calls) {
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      console.log(`Tool call: ${toolName}(${JSON.stringify(toolArgs)})`);

      const result = await executeTool(toolName, toolArgs);
      const jsonResult = JSON.stringify(result);
      console.log(`Tool result: ${jsonResult}`);

      await sleep(2000);

      messages.push({
        role: "assistant",
        content: null,
        tool_calls: [toolCall],
      });
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content:
          toolName === "shellAPI" ? summarizeShellResult(result) : jsonResult,
      });

      if (toolName === "verify" && jsonResult.includes("FLG")) {
        console.log("\n*** SUCCESS! Task completed. ***");
        console.log(jsonResult);
        return;
      }
    }
  }

  console.log("\nMax iterations reached. Task ended.");
}

main();
