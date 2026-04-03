import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });
export const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
export const AIDEVS_KEY = process.env.AIDEVS_KEY;
