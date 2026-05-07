import { Router, type IRouter } from "express";
import { readSessionFromRequest } from "../lib/adminAuth";

const router: IRouter = Router();

router.get("/auth/me", (req, res): void => {
  const session = readSessionFromRequest(req);
  if (!session) {
    res.json({
      isAuthenticated: false,
      isEditor: false,
      userId: null,
      email: null,
      firstName: null,
      lastName: null,
      role: null,
      team: null,
    });
    return;
  }
  res.json({
    isAuthenticated: true,
    isEditor: true,
    userId: `admin:${session.username}`,
    email: session.email,
    firstName: session.firstName ?? session.username,
    lastName: session.lastName,
    role: "admin",
    team: null,
  });
});

export default router;
