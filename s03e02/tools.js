const tools = [
  {
    type: "function",
    function: {
      name: "shellAPI",
      description: "Execute a command in the shell API.",
      parameters: {
        type: "object",
        properties: {
          cmd: {
            type: "string",
            description: "Shell API command to execute.",
          },
        },
        required: ["cmd"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verify",
      description: "Verify if the acquired confirmation code is correct.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description:
              "Confirmation code(format: ECCS-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)",
          },
        },
        required: ["code"],
        additionalProperties: false,
      },
    },
  },
];
export default tools;
