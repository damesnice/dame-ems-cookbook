import { requireUser } from "./_auth.js";
import { findById, getUsers, saveUsers, sanitizeUser } from "./_users.js";
import { hashPassword, verifyPassword } from "./_passwords.js";
import { isValidPin } from "./_pin.js";

// Also handles PIN changes (POST) — folded in here rather than a
// separate route to stay under Vercel's Hobby-plan serverless function cap.
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

  if (req.method === "POST") {
    const { currentPin, newPin } = req.body || {};
    if (typeof currentPin !== "string" || typeof newPin !== "string") {
      res.status(400).json({ error: "Missing currentPin or newPin." });
      return;
    }
    if (!isValidPin(newPin)) {
      res.status(400).json({ error: "New PIN needs to be 4 to 8 digits." });
      return;
    }
    if (!verifyPassword(currentPin, user.pinHash)) {
      res.status(401).json({ error: "Current PIN is wrong." });
      return;
    }
    const users = await getUsers();
    const current = findById(users, user.id);
    current.pinHash = hashPassword(newPin);
    current.updatedAt = new Date().toISOString();
    await saveUsers(users);
    res.status(200).json({ ok: true });
    return;
  }

  res.setHeader("Allow", "GET, PATCH, POST");
  res.status(405).json({ error: "Method not allowed" });
}
