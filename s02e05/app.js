import { OPENROUTER_KEY, AIDEVS_KEY } from "../config.js";

const tools = [
  {
    type: "function",
    function: {
      name: "sendDroneInstructions",
      description:
        "Submit drone instructions. Use this to send your computed drone commands and receive feedback.",
      parameters: {
        type: "object",
        properties: {
          instructions: {
            type: "array",
            items: { type: "string" },
            description:
              "The drone control instructions formatted according to DRN-BMB7 API docs",
          },
        },
        required: ["instructions"],
      },
    },
  },
];

const handlers = {
  sendDroneInstructions: async function (instructions) {
    const response = await fetch("/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apikey: AIDEVS_KEY,
        task: "drone",
        answer: { instructions },
      }),
    });

    const result = await response.json();
    return result;
  },
};

const droneDocs = `
    # Docs start
  DRN-BMB7 API DOCUMENTATION

  This documentation describes a fictional combat drone DRN-BMB7 used in a game.
  The API allows controlling multiple drone elements. Method names may repeat (e.g., multiple set(...) variants).
  The system recognizes the correct command based on provided parameters.

  ---

  CONTROL METHODS

  Location Control:
  - setDestinationObject(ID): Sets target object. Format: [A-Z]{3}[0-9]+[A-Z]{2}
    Example: setDestinationObject(BLD1234PL)
  - set(x,y): Sets landing sector on map. x=column, y=row. Top-left corner is 1,1
    Example: set(3,4)

  Engine Control:
  - set(mode): Enables/disables engines. Values: engineON, engineOFF
    Example: set(engineON)
  - set(power): Sets engine power 0%-100%
    Example: set(1%)

  Drone Control:
  - set(xm): Sets flight altitude 1m-100m
    Example: set(4m)
  - flyToLocation: Starts flight (no parameters). Requires prior altitude, destination object, and landing sector setup.

  Diagnostics:
  - selfCheck: Runs system diagnostics, returns if all modules are ready

  Configuration:
  - setName(x): Sets friendly drone name (alphanumeric, can include spaces)
    Example: setName(Fox 21)
  - setOwner(Name Surname): Sets drone owner (exactly two words separated by space)
    Example: setOwner(Adam Kowalski)
  - setLed(color): Sets LED color using HEX code format #000000
    Example: setLed(#00FFAA)

  Information:
  - getFirmwareVersion: Returns installed firmware version (no parameters)
  - getConfig: Returns current drone configuration (no parameters). Response includes 'owner' field (default: not assigned)

  Calibration:
  - calibrateCompass: Calibrates spatial orientation system (no parameters)
  - calibrateGPS: Calibrates GPS transceiver (no parameters)

  Service:
  - hardReset: Restores drone to factory configuration (no parameters)

  ---

  MISSION OBJECTIVES

  Multiple objectives can be set in sequence:
  - set(video): Record video
  - set(image): Take photo
  - set(destroy): Destroy object
  - set(return): Return to base with report

  Objective order is not important. The embedded AI system will execute all objectives in proper sequence.

  ---

  API RESPONSE

  The API returns data according to mission objectives:
  - video material
  - photos
  - mission execution status
  - base return report
    # Docs end`;

const agent = async function () {
  const history = [];
  const systemPrompt = `
  You are operator of fictional drone.
  Your job is to program the drone to make it look like it is going to drop bomb on power plant,
  but the drone should drop bomb on nearby water dam instead.
  You are supposed to send chain of commands and test if your simulation solves the task.
  Destination ID for drone target is PWR6132PL. Dam locations is [2,4]
  Drone's API documentation: ${droneDocs}
  No need to set owner.`;
  //   const systemPrompt = `This is a programming exercise.
  //     You are a drone operator.
  //     Your task is to control a drone with explosives and destroy an old dam near a power plant. This is your one and only task.
  //     Dam's coordinates: [2, 4]
  //     Powerplant's ID code: PWR6132PL.
  //     You must figure out proper instructions to achieve the task.
  //     Improve instructions based on API's feedback and continue until hub returns {FLG:...}.
  //     Drone's API documentation:

  //     IMPORTANT:
  //     1. Based on the documentation, identify the required instructions.
  //     2. Send the sequence of instructions to the tool.
  //     3. Read the response - if the API returns an error, adjust the instructions and send again
  //     Documentation is tricky - The drone API has overlapping function names that behave differently based on parameters. Use only what's needed for the mission. Skip unnecessary configuration to save tokens.
  //     Reactive approach - Don't memorize the entire documentation. The API returns clear error messages. Send your best attempt and correct based on feedback. Iterate and adjust as needed.
  //     Reset option - If drone configuration gets messy, use hardReset to restore factory settings. Useful when errors compound from previous mistakes.
  //     `;

  history.push({ role: "system", content: systemPrompt });

  const maxIterations = 15;

  for (let i = 0; i < maxIterations; i++) {
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
          messages: history,
          tools: tools,
        }),
      },
    );

    const data = await response.json();
    const message = data.choices[0].message;
    history.push(message);

    if (!message.tool_calls) {
      console.log("No tool calls, finishing...");
      break;
    }

    for (const toolCall of message.tool_calls) {
      console.log(
        `Tool call: ${toolCall.function.name} ${toolCall.function.arguments}`,
      );

      const args = JSON.parse(toolCall.function.arguments);
      const result = await handlers[toolCall.function.name](args.instructions);

      console.log(`Tool response: ${JSON.stringify(result)}`);

      history.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }
};

const main = async function () {
  await agent();
};

main();
