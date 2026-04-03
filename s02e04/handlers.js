import { AIDEVS_KEY } from "../config.js";

const handlers = {
  api_interact: async function (body) {
    const payload = {
      apikey: AIDEVS_KEY,
      ...body,
    };
    const response = await fetch("/api/zmail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const answer = await response.json();
    return answer;
  },
  verify: async function ({ answer }) {
    console.log(`CALLING VERIFY:`, answer);
    const response = await fetch("/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apikey: AIDEVS_KEY,
        task: "mailbox",
        answer: answer,
      }),
    });

    const result = await response.json();
    return result;
  },
};

export default handlers;
