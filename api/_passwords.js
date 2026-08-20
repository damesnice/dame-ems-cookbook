import crypto from "crypto";

const N = 16384;
const r = 8;
const p = 1;
const KEYLEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEYLEN, { N, r, p }).toString("hex");
  return `scrypt$${salt}$${N}$${r}$${p}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, salt, nStr, rStr, pStr, hashHex] = parts;
  const hash = crypto.scryptSync(password, salt, KEYLEN, {
    N: Number(nStr),
    r: Number(rStr),
    p: Number(pStr),
  });
  const expected = Buffer.from(hashHex, "hex");
  return expected.length === hash.length && crypto.timingSafeEqual(expected, hash);
}
