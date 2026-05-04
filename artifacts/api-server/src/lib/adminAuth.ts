import crypto from "node:crypto";
import type { Request } from "express";
import { logger } from "./logger";

export interface AdminAccount {
  username: string;
  password: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: "admin";
}

export interface AdminSession {
  username: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

export function formatDisplayName(account: Pick<AdminAccount, "username" | "firstName" | "lastName">): string {
  const parts = [account.firstName, account.lastName].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(" ") : account.username;
}

export const ADMIN_COOKIE_NAME = "admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

// Hardcoded fallbacks used only when the corresponding TD_* env vars are
// missing or malformed. Doppler should override these in every real
// environment (preprod, production). Once Doppler injection is verified, this
// entire block can be deleted.
const FALLBACK_ACCOUNTS: AdminAccount[] = [
  { username: "ericjivraj", password: "anafzuzwMNVfwAM2", firstName: "Eric", lastName: "Jivraj", email: null, role: "admin" },
  { username: "dipikamakan", password: "4Z9caUaZCOzZyVpI", firstName: "Dipika", lastName: "Makan", email: null, role: "admin" },
  { username: "alejandrotabares", password: "NLPYRlYCsgJVm1sw", firstName: "Alejandro", lastName: "Tabares", email: null, role: "admin" },
];
const FALLBACK_SESSION_SECRET = "2dusjIfocOHJjsh9sG1nyoY4ADIenMA7B6vIeEZZxVY";

let cachedAccounts: AdminAccount[] | null = null;

function loadAccounts(): AdminAccount[] {
  if (cachedAccounts) return cachedAccounts;
  const raw = process.env.TD_ADMIN_ACCOUNTS;
  if (!raw || !raw.trim()) {
    logger.warn("TD_ADMIN_ACCOUNTS env var not set — using hardcoded fallback accounts");
    cachedAccounts = FALLBACK_ACCOUNTS;
    return cachedAccounts;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new Error("TD_ADMIN_ACCOUNTS must be a JSON array");
    cachedAccounts = parsed.map((entry, idx) => {
      if (!entry || typeof entry !== "object") {
        throw new Error(`TD_ADMIN_ACCOUNTS[${idx}] is not an object`);
      }
      const obj = entry as Record<string, unknown>;
      const username = obj.username;
      const password = obj.password;
      if (typeof username !== "string" || !username) {
        throw new Error(`TD_ADMIN_ACCOUNTS[${idx}].username is required`);
      }
      if (typeof password !== "string" || !password) {
        throw new Error(`TD_ADMIN_ACCOUNTS[${idx}].password is required`);
      }
      const email = typeof obj.email === "string" && obj.email ? obj.email : null;
      const firstName = typeof obj.firstName === "string" && obj.firstName ? obj.firstName : null;
      const lastName = typeof obj.lastName === "string" && obj.lastName ? obj.lastName : null;
      return { username, password, email, firstName, lastName, role: "admin" as const };
    });
    return cachedAccounts;
  } catch (err) {
    logger.error({ err }, "Failed to parse TD_ADMIN_ACCOUNTS env var — using hardcoded fallback accounts");
    cachedAccounts = FALLBACK_ACCOUNTS;
    return cachedAccounts;
  }
}

function getSecret(): string {
  const secret = process.env.TD_ADMIN_SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;
  logger.warn("TD_ADMIN_SESSION_SECRET env var not set or too short — using hardcoded fallback");
  return FALLBACK_SESSION_SECRET;
}

function timingSafeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifyCredentials(username: string, password: string): AdminAccount | null {
  const accounts = loadAccounts();
  for (const acc of accounts) {
    if (
      timingSafeEqualString(acc.username, username) &&
      timingSafeEqualString(acc.password, password)
    ) {
      return acc;
    }
  }
  return null;
}

export function findAccountByUsername(username: string): AdminAccount | null {
  for (const acc of loadAccounts()) {
    if (acc.username === username) return acc;
  }
  return null;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionCookie(account: AdminAccount): { value: string; maxAgeSeconds: number } {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${account.username}.${expiresAt}`;
  const signature = sign(payload);
  return { value: `${payload}.${signature}`, maxAgeSeconds: SESSION_TTL_SECONDS };
}

export function readSessionFromRequest(req: Request): AdminSession | null {
  const raw = req.cookies?.[ADMIN_COOKIE_NAME];
  if (typeof raw !== "string" || !raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [username, expiresAtRaw, signature] = parts;
  const payload = `${username}.${expiresAtRaw}`;
  const expectedSignature = (() => {
    try {
      return sign(payload);
    } catch {
      return null;
    }
  })();
  if (!expectedSignature || !timingSafeEqualString(signature, expectedSignature)) {
    return null;
  }
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 < Date.now()) return null;
  const account = findAccountByUsername(username);
  if (!account) return null;
  return {
    username: account.username,
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
  };
}

export function adminSessionCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS * 1000,
  };
}
