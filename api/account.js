import { requireUser } from "./_auth.js";
import { findById, getUsers, saveUsers, sanitizeUser } from "./_users.js";

export default async function handler(req, res) {
  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  if (req.method === "GET") {
    res.status(200).json(sanitizeUser(user));
    return;
  }

  if (req.method === "PATCH") {
    const { name, email } = req.body || {};
    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      res.status(400).json({ error: "Name can't be empty." });
      return;
    }
    if (email !== undefined && (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email))) {
      res.status(400).json({ error: "That doesn't look like a valid email." });
      return;
    }
    const users = await getUsers();
    const current = findById(users, user.id);
    if (name !== undefined) current.name = name.trim();
    if (email !== undefined) current.email = email.trim().toLowerCase();
    current.updatedAt = new Date().toISOString();
    await saveUsers(users);
    res.status(200).json(sanitizeUser(current));
    return;
  }

  res.setHeader("Allow", "GET, PATCH");
  res.status(405).json({ error: "Method not allowed" });
}
