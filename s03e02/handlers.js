import { AIDEVS_KEY, AIDEVS_API_URL } from "../config.js";
const handlers = {
  shellAPI: async function (cmd) {
    const response = await fetch(`${AIDEVS_API_URL}/api/shell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: AIDEVS_KEY,
        cmd,
      }),
    });

    return response.json();
  },
  verify: async function (code) {
    const response = await fetch(`${AIDEVS_API_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: AIDEVS_KEY,
        task: "firmware",
        answer: { confirmation: code },
      }),
    });

    return response.json();
  },
};
export default handlers;
