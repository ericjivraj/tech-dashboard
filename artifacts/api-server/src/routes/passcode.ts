import { Router, type IRouter } from "express";
import { isPasscodeRequired, setPasscode, verifyPasscode } from "../lib/sitePasscode";
import { readSessionFromRequest } from "../lib/adminAuth";

const router: IRouter = Router();

const MIN_PASSCODE_LENGTH = 4;

// Public: tells the frontend whether to show the passcode prompt at all.
router.get("/passcode/status", async (_req, res): Promise<void> => {
  const required = await isPasscodeRequired();
  res.json({ required });
});

// Public: verify a submitted passcode against the bcrypt hash. The hash is
// never sent to the client. Returns 200 on success, 401 on mismatch.
router.post("/passcode/verify", async (req, res): Promise<void> => {
  const passcode = typeof req.body?.passcode === "string" ? req.body.passcode : "";
  if (!passcode) {
    res.status(400).json({ error: "passcode is required" });
    return;
  }
  const ok = await verifyPasscode(passcode);
  if (!ok) {
    res.status(401).json({ error: "Invalid passcode" });
    return;
  }
  res.json({ ok: true });
});

// Admin-only: rotate the site passcode. Stored as bcrypt hash, replacing
// any existing one (and superseding TD_SITE_PASSCODE env var from then on).
router.post("/admin/passcode", async (req, res): Promise<void> => {
  const session = readSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const newPasscode = typeof req.body?.newPasscode === "string" ? req.body.newPasscode : "";
  if (!newPasscode || newPasscode.length < MIN_PASSCODE_LENGTH) {
    res.status(400).json({ error: `Passcode must be at least ${MIN_PASSCODE_LENGTH} characters` });
    return;
  }
  await setPasscode(newPasscode);
  res.json({ ok: true });
});

export default router;
