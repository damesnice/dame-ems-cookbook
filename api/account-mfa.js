import { Redis } from "@upstash/redis";
import { requireUser } from "./_auth.js";
import { findById, getUsers, saveUsers, sanitizeUser } from "./_users.js";
import { verifyPassword } from "./_passwords.js";
import { generateSecret, otpauthURI, verifyTOTP } from "./_totp.js";
import { sendOTPEmail } from "./_email.js";
import { issueEmailOTP, verifyEmailOTP } from "./_otp-store.js";

const redis = Redis.fromEnv();
const SETUP_TTL = 60 * 10;

export default async function handler(req, res) {
  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  if (req.method === "GET") {
    res.status(200).json({ method: user.mfa?.method || null });
    return;
  }

  if (req.method === "POST") {
    const { method, confirmCode } = req.body || {};

    if (method === "totp" && !confirmCode) {
      const secret = generateSecret();
      await redis.set(`mfa-setup:${user.id}`, { secret }, { ex: SETUP_TTL });
      res.status(200).json({ secret, uri: otpauthURI(secret, user.email, "Dame & Ems Cookbook") });
      return;
    }

    if (method === "totp" && confirmCode) {
      const pending = await redis.get(`mfa-setup:${user.id}`);
      if (!pending || !verifyTOTP(pending.secret, confirmCode)) {
        res.status(400).json({ error: "That code didn't match. Try again." });
        return;
      }
      const users = await getUsers();
      const current = findById(users, user.id);
      current.mfa = { method: "totp", totp: { secretBase32: pending.secret, verifiedAt: new Date().toISOString() } };
      current.updatedAt = new Date().toISOString();
      await saveUsers(users);
      await redis.del(`mfa-setup:${user.id}`);
      res.status(200).json(sanitizeUser(current));
      return;
    }

    if (method === "email" && !confirmCode) {
      try {
        const code = await issueEmailOTP(`setup:${user.id}`);
        await sendOTPEmail(user.email, code);
        res.status(200).json({ sent: true });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
      return;
    }

    if (method === "email" && confirmCode) {
      const ok = await verifyEmailOTP(`setup:${user.id}`, confirmCode);
      if (!ok) {
        res.status(400).json({ error: "That code didn't match or has expired." });
        return;
      }
      const users = await getUsers();
      const current = findById(users, user.id);
      current.mfa = { method: "email", email: { verifiedAt: new Date().toISOString() } };
      current.updatedAt = new Date().toISOString();
      await saveUsers(users);
      res.status(200).json(sanitizeUser(current));
      return;
    }

    res.status(400).json({ error: "Unknown MFA method." });
    return;
  }

  if (req.method === "DELETE") {
    const { currentPassword } = req.body || {};
    if (!verifyPassword(currentPassword || "", user.passwordHash)) {
      res.status(401).json({ error: "Current password is wrong." });
      return;
    }
    const users = await getUsers();
    const current = findById(users, user.id);
    current.mfa = { method: null };
    current.updatedAt = new Date().toISOString();
    await saveUsers(users);
    res.status(200).json(sanitizeUser(current));
    return;
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  res.status(405).json({ error: "Method not allowed" });
}
