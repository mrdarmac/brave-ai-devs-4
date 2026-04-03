import { AIDEVS_KEY } from "../config.js";
const handlers = {
  call_API: async function (action, args) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [API CALL] action: ${action}`, args || "");

    let lastError = null;

    while (true) {
      try {
        const response = await fetch("/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apikey: AIDEVS_KEY,
            task: "railway",
            answer: {
              action: action,
              ...(args || {}),
            },
          }),
        });

        const status = response.status;
        const headers = {};
        for (const [key, value] of response.headers.entries()) {
          headers[key.toLowerCase()] = value;
        }

        const body = await response.json();
        const responseTimestamp = new Date().toISOString();

        console.log(`[${responseTimestamp}] [API RESPONSE] status: ${status}`);
        console.log(
          `[${responseTimestamp}] [API RESPONSE] body:`,
          JSON.stringify(body, null, 2),
        );

        if (status === 503) {
          console.log(
            `[${responseTimestamp}] [API ERROR] 503 Service Unavailable - will retry`,
          );
          const retryAfter = body.retry_after || 2;
          console.log(
            `[${responseTimestamp}] [API ERROR] Waiting ${retryAfter}s before retry...`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, retryAfter * 1000),
          );
          continue;
        }

        if (status === 429) {
          console.log(`[${responseTimestamp}] [API ERROR] 429 Rate Limited`);
          const retryAfter = body.retry_after || 5;
          const penalty = body.penalty_seconds || 0;
          const violations = headers["x-ratelimit-violations"] || "0";
          console.log(
            `[${responseTimestamp}] [API ERROR] Retry after: ${retryAfter}s, Penalty: ${penalty}s, Violations: ${violations}`,
          );
          console.log(
            `[${responseTimestamp}] [API ERROR] Waiting ${retryAfter}s before retry...`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, retryAfter * 1000),
          );
          continue;
        }

        if (status !== 200) {
          console.log(
            `[${responseTimestamp}] [API ERROR] Unexpected status: ${status}`,
          );
          throw new Error(
            `API returned status ${status}: ${JSON.stringify(body)}`,
          );
        }

        if (body.code && body.code < 0) {
          console.log(
            `[${responseTimestamp}] [API ERROR] Error code: ${body.code}, message: ${body.message}`,
          );
          throw new Error(body.message || `API error code: ${body.code}`);
        }

        console.log(`[${responseTimestamp}] [API SUCCESS]`);
        return body;
      } catch (error) {
        if (lastError && error.message === lastError.message) {
          console.log(`[API] Same error twice, waiting 5s: ${error.message}`);
          await new Promise((resolve) => setTimeout(resolve, 5000));
          lastError = error;
          continue;
        }
        lastError = error;
        throw error;
      }
    }
  },

  wait_and_retry: async function (retry_after) {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [WAIT] Waiting ${retry_after} seconds before retry...`,
    );
    await new Promise((resolve) => setTimeout(resolve, retry_after * 1000));
    const endTimestamp = new Date().toISOString();
    console.log(`[${endTimestamp}] [WAIT] Wait complete, will retry API call`);
  },
};

export default handlers;
