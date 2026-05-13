// Server-side site passcode handling. The bcrypt hash lives in
// site_passcode (single row, id=1). On startup we seed it from
// TD_SITE_PASSCODE if the table is empty, so existing deploys keep working.
// Verify + rotate happen via /api/passcode/* endpoints (frontend never sees
// the hash). If no row exists at all, the gate is treated as disabled (the
// frontend will skip rendering it), matching the legacy "no passcode
// configured" behavior.

import bcrypt from "bcryptjs";
import { db, sitePasscodeTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const BCRYPT_COST = 12;
const ROW_ID = 1;

export async function getStoredPasscodeHash(): Promise<string | null> {
  const [row] = await db
    .select({ hash: sitePasscodeTable.passwordHash })
    .from(sitePasscodeTable)
    .where(eq(sitePasscodeTable.id, ROW_ID));
  return row?.hash ?? null;
}

export async function isPasscodeRequired(): Promise<boolean> {
  return (await getStoredPasscodeHash()) !== null;
}

export async function verifyPasscode(input: string): Promise<boolean> {
  const hash = await getStoredPasscodeHash();
  if (!hash) return true; // no passcode configured → open access
  return bcrypt.compare(input, hash);
}

export async function setPasscode(newPasscode: string): Promise<void> {
  const hash = await bcrypt.hash(newPasscode, BCRYPT_COST);
  const now = new Date();
  await db
    .insert(sitePasscodeTable)
    .values({ id: ROW_ID, passwordHash: hash, updatedAt: now })
    .onConflictDoUpdate({
      target: sitePasscodeTable.id,
      set: { passwordHash: hash, updatedAt: now },
    });
}

// Seed the hash from TD_SITE_PASSCODE on first boot. Idempotent — only
// writes if the table is empty. Once the table has a hash, env-var changes
// are ignored (the DB hash is the source of truth, rotated via the admin
// panel).
export async function seedPasscodeFromEnv(): Promise<void> {
  const existing = await getStoredPasscodeHash();
  if (existing) return;
  const envValue = process.env.TD_SITE_PASSCODE;
  if (!envValue || !envValue.trim()) {
    logger.info("No TD_SITE_PASSCODE env var and no DB passcode — site gate disabled");
    return;
  }
  // Multi-passcode support: env var historically allowed comma-separated
  // values. We seed only the first one as the "canonical" passcode; admins
  // can change it later. Keeps migration simple.
  const first = envValue.split(",")[0].trim();
  if (!first) return;
  await setPasscode(first);
  logger.info("Site passcode seeded from TD_SITE_PASSCODE env var");
}
