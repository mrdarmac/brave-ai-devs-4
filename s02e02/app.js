import agent from "./agent.js";
import handlers from "./handlers.js";
import tools from "./tools.js";

const systemPrompt = `You are an assistant to a puzzle solver.
Your task is to analyze a 3x3 board of rotating connections and figure out how to solve it.
The solution is [[0, 1, 1, 0], [0, 1, 1, 1], [0, 1, 0, 1], [1, 0, 1, 0], [1, 1, 1, 0], [0, 1, 1, 1], [1, 1, 0, 1], [1, 0, 0, 1], [1, 1, 0, 0],]
You have 3 tools available:
getBoard - uses AI vision to download and get the current state of the board.
getRotations - calculates rotations needed on the current board to reach solution.
rotateTiles - applies the necessary rotations to the board.
If rotateTiles returns {FLG:...} then that's the final answer.
`;

const main = async function () {
  const history = [{ role: "system", content: systemPrompt }];
  const result = await agent(history, tools, handlers);
  console.log("Final response:", result);
};

main();
