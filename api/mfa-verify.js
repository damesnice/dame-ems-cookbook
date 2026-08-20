import {
  clearPendingMfaCookie,
  createSession,
  readPendingMfa,
  setSessionCookie,
} from "./_auth.js";
import { verifyTOTP } from "./_totp.js";
import { verifyEmailOTP } from "./_otp-store.js";
import { findById, getUsers, sanitizeUser } from "./_users.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const pending = readPendingMfa(req);
  if (!pending) {
    res.status(401).json({ error: "MFA session expired — please log in again." });
    return;
  }

  const { code } = req.body || {};
  const users = await getUsers();
  const user = findById(users, pending.userId);
  if (!user) {
    res.status(401).json({ error: "Account not found." });
    return;
  }

  let ok = false;
  if (pending.method === "totp") {
    ok = verifyTOTP(user.mfa?.totp?.secretBase32, code);
  } else if (pending.method === "email") {
    ok = await verifyEmailOTP(user.id, code);
  }

  if (!ok) {
    res.status(400).json({ error: "That code didn't match. Try again." });
    return;
  }

  clearPendingMfaCookie(res);
  const token = await createSession(user.id);
  setSessionCookie(res, token);
  res.status(200).json({ ok: true, user: sanitizeUser(user) });
}
