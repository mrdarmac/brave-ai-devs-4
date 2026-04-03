const tools = [
  {
    type: "function",
    function: {
      name: "api_interact",
      description:
        "Interact with the mail API. Pass any parameters required by the mail API (e.g., action: 'help').",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            description:
              "The action to perform (e.g., 'help', 'search', 'get')",
          },
        },
        additionalProperties: true,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verify",
      description:
        "Verify the mailbox task with password, date, and confirmation code.",
      parameters: {
        type: "object",
        properties: {
          answer: {
            type: "object",
            description:
              "The answer object containing password, date, and confirmation_code",
            properties: {
              password: {
                type: "string",
                description: "Password for verification",
              },
              date: {
                type: "string",
                description: "Date string for verification (YYYY-MM-DD)",
              },
              confirmation_code: {
                type: "string",
                description: "Confirmation code from the ticket",
              },
            },
            required: ["password", "date", "confirmation_code"],
          },
        },
        required: ["answer"],
      },
    },
  },
];

export default tools;
