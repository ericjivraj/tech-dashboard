import crypto from "node:crypto";
import type { Request } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, adminCredentialsTable } from "@workspace/db";

const BCRYPT_COST = 12;

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

let cachedAccounts: AdminAccount[] | null = null;

function loadAccounts(): AdminAccount[] {
  if (cachedAccounts) return cachedAccounts;
  const raw = process.env.TD_ADMIN_ACCOUNTS;
  if (!raw || !raw.trim()) {
    throw new Error("TD_ADMIN_ACCOUNTS env var is required (JSON array of {username, password, ...})");
  }
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
}

function getSecret(): string {
  const secret = process.env.TD_ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("TD_ADMIN_SESSION_SECRET env var is required and must be at least 16 characters");
  }
  return secret;
}

function timingSafeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

// Hybrid auth: TD_ADMIN_ACCOUNTS env var defines who is allowed in. For each
// allowed username, prefer a per-user bcrypt hash from the admin_credentials
// table when present; otherwise fall back to the env var's plaintext password.
// This lets users self-service their password via the UI without having to
// re-deploy or touch Doppler.
export async function verifyCredentials(username: string, password: string): Promise<AdminAccount | null> {
  const account = findAccountByUsername(username);
  if (!account) return null;
  // timingSafeEqualString on the username protects against username
  // enumeration via timing differences.
  if (!timingSafeEqualString(account.username, username)) return null;

  const [row] = await db
    .select({ hash: adminCredentialsTable.passwordHash })
    .from(adminCredentialsTable)
    .where(eq(adminCredentialsTable.username, username));

  if (row) {
    return (await bcrypt.compare(password, row.hash)) ? account : null;
  }
  return timingSafeEqualString(account.password, password) ? account : null;
}

export async function setPasswordHash(username: string, newPassword: string): Promise<void> {
  const account = findAccountByUsername(username);
  if (!account) {
    throw new Error(`Cannot set password for unknown username "${username}"`);
  }
  const hash = await bcrypt.hash(newPassword, BCRYPT_COST);
  const now = new Date();
  await db
    .insert(adminCredentialsTable)
    .values({ username, passwordHash: hash, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: adminCredentialsTable.username,
      set: { passwordHash: hash, updatedAt: now },
    });
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
  const expectedSignature = sign(payload);
  if (!timingSafeEqualString(signature, expectedSignature)) return null;
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
