import vision from "./vision.js";

const handlers = {
  async getContent(documentName) {
    console.log(`Fetching: /dane/doc/${documentName}`);
    const response = await fetch(
      `/dane/doc/${documentName}`,
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get("Content-Type") || "";

    if (contentType.includes("text/plain")) {
      console.log("TEXT");
      const text = await response.text();
      return text;
    } else if (contentType.includes("image/")) {
      console.log("IMAGE");
      //   const buffer = await response.arrayBuffer();
      //   const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const answer = await vision(documentName);
      return answer;
    } else {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
  },
};

export default handlers;
