const tools = [
  {
    type: "function",
    function: {
      name: "check_package",
      description: "Check status of a package.",
      parameters: {
        type: "object",
        properties: {
          packageid: {
            type: "string",
            description: "Package's ID.",
          },
        },
        required: ["packageid"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "redirect_package",
      description: "Redirect package.",
      parameters: {
        type: "object",
        properties: {
          packageid: {
            type: "string",
            description: "Package's ID.",
          },
          destination: {
            type: "string",
            description: "New destination.",
          },
          code: {
            type: "string",
            description: "Security code.",
          },
        },
        required: ["packageid", "destination", "code"],
        additionalProperties: false,
      },
    },
  },
];

export default tools;
