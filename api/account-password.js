import { requireUser } from "./_auth.js";
import { findById, getUsers, saveUsers } from "./_users.js";
import { hashPassword, verifyPassword } from "./_passwords.js";

export default async function handler(req, res) {
  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    res.status(400).json({ error: "Missing currentPassword or newPassword." });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "New password needs to be at least 8 characters." });
    return;
  }
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    res.status(401).json({ error: "Current password is wrong." });
    return;
  }

  const users = await getUsers();
  const current = findById(users, user.id);
  current.passwordHash = hashPassword(newPassword);
  current.updatedAt = new Date().toISOString();
  await saveUsers(users);
  res.status(200).json({ ok: true });
}
