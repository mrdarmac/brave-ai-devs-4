import { OPENROUTER_KEY, AIDEVS_KEY } from "../config.js";
const agent = async function (history, tools, handlers) {
  await fetch(
    `/data/${AIDEVS_KEY}/electricity.png?reset=1`,
  );
  console.log("Board reset");

  const callLLM = async (messages) => {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: messages,
          tools: tools,
        }),
      },
    );
    return response.json();
  };

  let response = await callLLM(history);
  console.log("Initial LLM response:", JSON.stringify(response, null, 2));
  let iteration = 0;

  if (!response.choices || !response.choices[0]) {
    console.log("No choices in response");
    return response;
  }

  while (iteration < 5 && response.choices[0].message.tool_calls) {
    iteration++;
    const toolCalls = response.choices[0].message.tool_calls;
    history.push(response.choices[0].message);

    for (const toolCall of toolCalls) {
      const { name, arguments: args } = toolCall.function;
      const parsedArgs = JSON.parse(args);

      console.log(`Executing tool: ${name}`);
      const result = await handlers[name](...Object.values(parsedArgs));
      console.log(`Result:`, result);

      history.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    response = await callLLM(history);
  }

  return response.choices[0].message.content;
};

export default agent;
