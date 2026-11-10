import mongoose from "mongoose";
import { config } from "./config.js";

export async function connectDb() {
  if (!config.mongoUri) {
    throw new Error("MONGODB_URI is not set. Check atlas-credentials.env or backend/.env");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");
}