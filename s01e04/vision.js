import { OPENROUTER_KEY, AIDEVS_API_URL } from "../config.js";

const vision = async function (imageName) {
  const prompt = `Your task is to analyze the attached image and extract text from it exactly as it is.
            Return text information from the image as JSON.
            Only return the text that is in the image. 
            Do not modify it or add any comments.`;

  // Call llm
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: prompt,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `${AIDEVS_API_URL}/dane/doc/${imageName}`,
                },
              },
            ],
          },
        ],
      }),
    },
  );

  const data = await response.json();
  const answer = data.choices[0].message.content;
  console.log(answer);
  return answer;
};

export default vision;
