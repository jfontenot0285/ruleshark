import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(root, "atlas-credentials.env") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const mongoUri =
  process.env.MONGODB_URI ||
  (process.env.MONGODB_USERNAME && process.env.MONGODB_PASSWORD
    ? `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.cqr2jzq.mongodb.net/ruleshark`
    : "");

export const config = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: ensureDbName(mongoUri),
  jwtSecret: process.env.JWT_SECRET || "ruleshark-dev-secret-change-me",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
};

function ensureDbName(uri) {
  if (!uri) return uri;
  // Atlas URI from onboarding often omits a database name
  if (/mongodb(?:\+srv)?:\/\/[^/]+\/?$/.test(uri.split("?")[0])) {
    const [base, query] = uri.split("?");
    return `${base.replace(/\/?$/, "")}/ruleshark${query ? `?${query}` : ""}`;
  }
  return uri;
}