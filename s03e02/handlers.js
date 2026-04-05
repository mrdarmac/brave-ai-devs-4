import { AIDEVS_KEY } from "../config.js";
const handlers = {
  shellAPI: async function (cmd) {
    const response = await fetch("/api/shell", {
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
    const response = await fetch("/verify", {
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
