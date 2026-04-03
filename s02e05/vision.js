import { OPENROUTER_KEY, AIDEVS_KEY } from "../config.js";
const vision = async function (
  prompt,
  image_url,
  model = "google/gemini-3-flash-preview",
  reasoning = false,
  temperature = 0.0,
) {
  console.log("@_@".repeat(20));
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
        model,
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
                  url: image_url,
                },
              },
            ],
          },
        ],
        reasoning: { enabled: reasoning },
        temperature,
      }),
    },
  );

  const data = await response.json();
  const content = data.choices[0].message.content;

  console.log("Vision details:");
  console.log(`Total tokens: ${data.usage.total_tokens}`);
  console.log(`Cost: ${data.usage.cost}`);
  console.log(`Answer:\n${content}`);
  console.log("@_@".repeat(20));
  return content;
  //   const cleaned = content.replace(/```json\n?|```/g, "").trim();
  //   let answer = JSON.parse(cleaned);
  //   answer = Object.values(answer);
};

export default vision;

/*
console.log("⚡Starting.");
  const visionPrompt = `Analyze this map.
  It's divided into sectors by red line.
  Indexing for both rows and columns starts at 1.
  Your goal is to find sector with a dam.
  The water's color was intentionally intensified at the dam to make it easier to spot.
  Return ONLY the correct sector as [column, row]. No extra comments.
  `;
  const damLocation = await vision(
    visionPrompt,
    `/data/${AIDEVS_KEY}/drone.png`,
  );
*/
