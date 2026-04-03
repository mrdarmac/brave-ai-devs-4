import { OPENROUTER_KEY, AIDEVS_KEY } from "../config.js";
const handlers = {
  getBoard: async function () {
    const prompt = `You are given a 3x3 electricity puzzle board image.
    Describe EACH of the 9 tiles (1x1..3x3). For every tile, assign which sides have a cable connection [top, right, bottom, left].
    Focus only on the board. Do not guess. Ignore pictures, text and numbers around the board.
    Hint: 3x1:[1, 0, 1, 1]
    Output STRICT JSON only with keys '1x1'..'3x3' and each value as an array of numbers(0 or 1).
    Example: {"1x1":[0, 1, 1, 0],"1x2":[1, 1, 1, 0],...}.
    Do not include any extra keys or commentary.`;

    const max_iterations = 3;
    let curr_iteration = 0;
    const expected = [
      [0, 1, 1, 0],
      [1, 1, 1, 0],
      [1, 0, 1, 0],
      [0, 1, 0, 1],
      [0, 1, 1, 1],
      [0, 1, 1, 1],
      [1, 0, 1, 1],
      [1, 0, 0, 1],
      [1, 1, 0, 0],
    ];

    while (curr_iteration < max_iterations) {
      curr_iteration++;

      console.log("Vision call in progress...");
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: prompt,
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `/data/${AIDEVS_KEY}/electricity.png`,
                    },
                  },
                ],
              },
            ],
            reasoning: { enabled: true },
            temperature: 0.0,
          }),
        },
      );

      const data = await response.json();
      const content = data.choices[0].message.content;
      //       const content = `\`\`\`json
      // {
      //   "1x1": [0, 1, 1, 0],
      //   "1x2": [1, 1, 1, 0],
      //   "1x3": [1, 0, 1, 0],
      //   "2x1": [0, 1, 0, 1],
      //   "2x2": [1, 1, 0, 1],
      //   "2x3": [0, 1, 1, 1],
      //   "3x1": [1, 0, 1, 1],
      //   "3x2": [1, 0, 0, 1],
      //   "3x3": [1, 1, 0, 0]
      // }
      // \`\`\``;
      console.log("Vision details:");
      console.log(`Total tokens: ${data.usage.total_tokens}`);
      console.log(`Cost: ${data.usage.cost}`);
      console.log(`Answer:\n${content}`);
      console.log("=================");

      const cleaned = content.replace(/```json\n?|```/g, "").trim();
      let answer = JSON.parse(cleaned);
      answer = Object.values(answer);

      if (
        expected.every(
          (val, index) => JSON.stringify(val) === JSON.stringify(answer[index]),
        )
      ) {
        return answer;
      } else {
        console.log("Vision answer doesn't match expected answer.");
        console.log(`Vision iteration: ${curr_iteration}`);
        console.log(`Max iterations: ${max_iterations}`);
        if (curr_iteration < max_iterations) {
          console.log("Trying again...");
        }
        if (curr_iteration === max_iterations) {
          return "Couldn't properly analyze the image. Try again.";
        }
      }
    }
  },
  getRotations: async function (current, solution) {
    let rotations = [0, 0, 0, 0, 0, 0, 0, 0, 0];

    current.forEach((el, i) => {
      while (JSON.stringify(el) !== JSON.stringify(solution[i])) {
        rotations[i]++;
        el.unshift(el.pop());
      }

      return;
    });

    return rotations;
  },
  rotateTiles: async function (rotations) {
    const tiles = [
      "1x1",
      "1x2",
      "1x3",
      "2x1",
      "2x2",
      "2x3",
      "3x1",
      "3x2",
      "3x3",
    ];

    const rotate = async function (tile) {
      const response = await fetch("/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apikey: AIDEVS_KEY,
          task: "electricity",
          answer: {
            rotate: tile,
          },
        }),
      });
      const answer = await response.json();
      return answer;
    };

    let finalResult;
    for (let i = 0; i < rotations.length; i++) {
      let el = rotations[i];
      while (el > 0) {
        el--;
        finalResult = await rotate(tiles[i]);
        console.log(finalResult);
      }
    }

    return finalResult;
  },
};

export default handlers;
