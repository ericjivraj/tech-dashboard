import { Router, type IRouter } from "express";
import {
  ADMIN_COOKIE_NAME,
  adminSessionCookieOptions,
  createSessionCookie,
  verifyCredentials,
} from "../lib/adminAuth";

const router: IRouter = Router();

router.post("/admin/login", (req, res): void => {
  const username = typeof req.body?.username === "string" ? req.body.username : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  const account = verifyCredentials(username, password);
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

export default router;
