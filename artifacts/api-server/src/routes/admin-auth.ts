import { Router, type IRouter } from "express";
import {
  ADMIN_COOKIE_NAME,
  adminSessionCookieOptions,
  createSessionCookie,
  readSessionFromRequest,
  setPasswordHash,
  verifyCredentials,
} from "../lib/adminAuth";

const router: IRouter = Router();

const MIN_PASSWORD_LENGTH = 8;

router.post("/admin/login", async (req, res): Promise<void> => {
  const username = typeof req.body?.username === "string" ? req.body.username : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  const account = await verifyCredentials(username, password);
  if (!account) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const cookie = createSessionCookie(account);
  res.cookie(ADMIN_COOKIE_NAME, cookie.value, adminSessionCookieOptions());
  res.json({
    isAuthenticated: true,
    username: account.username,
    email: account.email,
    role: account.role,
  });
});

router.post("/admin/logout", (_req, res): void => {
  res.clearCookie(ADMIN_COOKIE_NAME, { ...adminSessionCookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

// Change the logged-in admin's password. Verifies current password before
// accepting. Existing session cookies stay valid (signed against
// TD_ADMIN_SESSION_SECRET, not the user password) — so the user isn't kicked
// out after rotating.
router.post("/admin/change-password", async (req, res): Promise<void> => {
  const session = readSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "currentPassword and newPassword are required" });
    return;
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    return;
  }
  if (newPassword === currentPassword) {
    res.status(400).json({ error: "New password must differ from current password" });
    return;
  }

  const account = await verifyCredentials(session.username, currentPassword);
  if (!account) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  await setPasswordHash(session.username, newPassword);
  res.json({ ok: true });
});

export default router;
