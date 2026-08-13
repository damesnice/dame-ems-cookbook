import { Redis } from "@upstash/redis";
import { isAuthed } from "./_auth.js";

const redis = Redis.fromEnv();
const KEY = "families";

export default async function handler(req, res) {
  if (!isAuthed(req)) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  if (req.method === "GET") {
    const families = (await redis.get(KEY)) || [];
    res.status(200).json(families);
    return;
  }

  if (req.method === "PUT") {
    const families = req.body;
    if (!Array.isArray(families)) {
      res.status(400).json({ error: "Expected an array of families" });
      return;
    }
    await redis.set(KEY, families);
    res.status(200).json({ ok: true });
    return;
  }

  res.setHeader("Allow", "GET, PUT");
  res.status(405).json({ error: "Method not allowed" });
}
