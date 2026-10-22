import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const CHALLENGE_TTL = 60 * 5;

export const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
export const rpName = process.env.WEBAUTHN_RP_NAME || "Dame and Ems' Cookbook";
// WEBAUTHN_ORIGIN is a hidden env var that can drift from the real URL, and a
// mismatch only shows up as an opaque Face ID failure. Accept the origin
// implied by rpID too, so production works as long as WEBAUTHN_RP_ID is right.
export const origin = [
  ...new Set([
    process.env.WEBAUTHN_ORIGIN || "http://localhost:3411",
    ...(rpID === "localhost" ? [] : [`https://${rpID}`]),
  ]),
];

export async function storeChallenge(key, challenge) {
  await redis.set(`webauthn-challenge:${key}`, challenge, { ex: CHALLENGE_TTL });
}

export async function takeChallenge(key) {
  const value = await redis.get(`webauthn-challenge:${key}`);
  await redis.del(`webauthn-challenge:${key}`);
  return value || null;
}
