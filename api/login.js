import {
  clearPendingMfaCookie,
  clearSessionCookie,
  createSession,
  requireUser,
  setPendingMfaCookie,
  setSessionCookie,
} from "./_auth.js";
import { sendOTPEmail } from "./_email.js";
import { issueEmailOTP } from "./_otp-store.js";
import { findByIdentifier, getUsers, sanitizeUser } from "./_users.js";
import { verifyPassword } from "./_passwords.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const user = await requireUser(req);
    res.status(200).json({ authed: !!user, user: sanitizeUser(user) });
    return;
  }

  if (req.method === "POST") {
    const { identifier, password } = req.body || {};
    if (typeof identifier !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "Missing identifier or password." });
      return;
    }

    const users = await getUsers();
    const user = findByIdentifier(users, identifier);
    const ok = user && verifyPassword(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Wrong email/name or password." });
      return;
    }

    const method = user.mfa?.method || null;
    if (!method) {
      const token = await createSession(user.id);
      setSessionCookie(res, token);
      res.status(200).json({ ok: true, mfaRequired: false, user: sanitizeUser(user) });
      return;
    }

    setPendingMfaCookie(res, user.id, method);
    if (method === "email") {
      try {
        const code = await issueEmailOTP(user.id);
        await sendOTPEmail(user.email, code);
      } catch (err) {
        res.status(200).json({ ok: true, mfaRequired: true, method, emailError: err.message });
        return;
      }
    }
    res.status(200).json({ ok: true, mfaRequired: true, method });
    return;
  }

  if (req.method === "DELETE") {
    clearSessionCookie(res);
    clearPendingMfaCookie(res);
    res.status(200).json({ ok: true });
    return;
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  res.status(405).json({ error: "Method not allowed" });
}
