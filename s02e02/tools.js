const tools = [
  {
    type: "function",
    function: {
      name: "getBoard",
      description:
        "Analyzes a 3x3 electricity puzzle board image using AI vision. Returns a 9-element array where each element represents a tile's connections [top, right, bottom, left].",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getRotations",
      description:
        "Calculates the number of clockwise rotations needed for each tile to match the solution state.",
      parameters: {
        type: "object",
        properties: {
          current: {
            type: "array",
            items: {
              type: "array",
              items: {
                type: "integer"
              }
            },
            description: "Array of 9 current tile configurations",
          },
          solution: {
            type: "array",
            items: {
              type: "array",
              items: {
                type: "integer"
              }
            },
            description: "Array of 9 target tile configurations",
          },
        },
        required: ["current", "solution"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rotateTiles",
      description:
        "Executes rotation commands on the electricity puzzle board to align tiles with the solution.",
      parameters: {
        type: "object",
        properties: {
          rotations: {
            type: "array",
            items: {
              type: "integer"
            },
            description:
              "Array of 9 numbers, each indicating how many times to rotate that tile",
          },
        },
        required: ["rotations"],
      },
    },
  },
];

export default tools;
