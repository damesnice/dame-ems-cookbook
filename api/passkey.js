import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { createSession, requireUser, setSessionCookie } from "./_auth.js";
import { findByIdentifier, findById, getUsers, saveUsers, sanitizeUser } from "./_users.js";
import { origin, rpID, rpName, storeChallenge, takeChallenge } from "./_webauthn.js";

// Registration (authenticated, adds a passkey to the current account) and
// login (unauthenticated, signs in with an existing passkey) share one
// route — split by ?action=register vs the default login path — to stay
// under Vercel's Hobby-plan serverless function cap.

async function registrationOptions(req, res) {
  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: (user.webauthn?.credentials || []).map((c) => ({
      id: c.id,
      transports: c.transports,
    })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });
  await storeChallenge(user.id, options.challenge);
  res.status(200).json(options);
}

async function verifyRegistration(req, res) {
  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const expectedChallenge = await takeChallenge(user.id);
  if (!expectedChallenge) {
    res.status(400).json({ error: "Registration expired — try again." });
    return;
  }
  const response = { ...(req.body || {}) };
  delete response.action;
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || "Couldn't verify that passkey." });
    return;
  }
  if (!verification.verified || !verification.registrationInfo) {
    res.status(400).json({ error: "Couldn't verify that passkey." });
    return;
  }

  const { credential } = verification.registrationInfo;
  const users = await getUsers();
  const current = findById(users, user.id);
  current.webauthn = current.webauthn || { credentials: [] };
  current.webauthn.credentials.push({
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: credential.transports || [],
    deviceLabel: "Passkey",
    createdAt: new Date().toISOString(),
  });
  current.updatedAt = new Date().toISOString();
  await saveUsers(users);
  res.status(200).json(sanitizeUser(current));
}

async function loginOptions(req, res) {
  const { identifier } = req.query || {};
  const users = await getUsers();
  const user = findByIdentifier(users, identifier || "");
  const credentials = user?.webauthn?.credentials || [];
  if (!user || credentials.length === 0) {
    res.status(404).json({ error: "No passkey registered for that account." });
    return;
  }
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map((c) => ({ id: c.id, transports: c.transports })),
    userVerification: "preferred",
  });
  await storeChallenge(`login:${user.id}`, options.challenge);
  res.status(200).json({ ...options, userId: user.id });
}

async function verifyLogin(req, res) {
  const { userId, response } = req.body || {};
  if (!userId || !response) {
    res.status(400).json({ error: "Missing userId or response." });
    return;
  }
  const expectedChallenge = await takeChallenge(`login:${userId}`);
  if (!expectedChallenge) {
    res.status(400).json({ error: "Sign-in expired — try again." });
    return;
  }
  const users = await getUsers();
  const user = findById(users, userId);
  const stored = user?.webauthn?.credentials?.find((c) => c.id === response.id);
  if (!user || !stored) {
    res.status(400).json({ error: "Unknown passkey." });
    return;
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: stored.id,
        publicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64url")),
        counter: stored.counter,
        transports: stored.transports,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message || "Couldn't verify that passkey." });
    return;
  }
  if (!verification.verified) {
    res.status(400).json({ error: "Couldn't verify that passkey." });
    return;
  }

  stored.counter = verification.authenticationInfo.newCounter;
  await saveUsers(users);

  const token = await createSession(user.id);
  setSessionCookie(res, token);
  res.status(200).json({ ok: true, user: sanitizeUser(user) });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    if (req.query?.action === "register") {
      await registrationOptions(req, res);
    } else {
      await loginOptions(req, res);
    }
    return;
  }

  if (req.method === "POST") {
    if (req.body?.action === "register") {
      await verifyRegistration(req, res);
    } else {
      await verifyLogin(req, res);
    }
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method not allowed" });
}
