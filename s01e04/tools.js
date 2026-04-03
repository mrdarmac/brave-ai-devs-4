const tools = [
  {
    type: "function",
    function: {
      name: "getContent",
      description: "Get content from a file.",
      parameters: {
        type: "object",
        properties: {
          documentName: {
            type: "string",
            description: "Document's name. Example: 'zalacznik-A.md'",
          },
        },
        required: ["documentName"],
        additionalProperties: false,
      },
    },
  },
];

export default tools;
