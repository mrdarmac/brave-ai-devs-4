import { AIDEVS_KEY } from "../config.js";
const handlers = {
  async check_package(packageid) {
    const response = await fetch("/api/packages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apikey: AIDEVS_KEY,
        action: "check",
        packageid,
      }),
    });

    return await response.json();
  },
  async redirect_package(packageid, destination, code) {
    const response = await fetch("/api/packages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apikey: AIDEVS_KEY,
        action: "redirect",
        packageid,
        destination,
        code,
      }),
    });

    return await response.json();
  },
};

export default handlers;
