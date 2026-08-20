import {
  clearPendingMfaCookie,
  clearSessionCookie,
  createSession,
  readPendingMfa,
  requireUser,
  setPendingMfaCookie,
  setSessionCookie,
} from "./_auth.js";
import { sendOTPEmail } from "./_email.js";
import { issueEmailOTP, verifyEmailOTP } from "./_otp-store.js";
import { verifyTOTP } from "./_totp.js";
import { findByIdentifier, findById, getUsers, sanitizeUser } from "./_users.js";
import { verifyPassword } from "./_passwords.js";

// Also handles the second MFA step (POST with just {code}) — folded in here
// rather than a separate route to stay under Vercel's Hobby-plan serverless
// function cap.
async function verifyMfaCode(req, res) {
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

export default async function handler(req, res) {
  if (req.method === "GET") {
    const user = await requireUser(req);
    res.status(200).json({ authed: !!user, user: sanitizeUser(user) });
    return;
  }

  if (req.method === "POST") {
    const { identifier, password, code } = req.body || {};

    if (code !== undefined) {
      await verifyMfaCode(req, res);
      return;
    }

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
        const emailCode = await issueEmailOTP(user.id);
        await sendOTPEmail(user.email, emailCode);
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
