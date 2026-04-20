import { Router, type IRouter } from "express";
import { getAuth, createClerkClient } from "@clerk/express";
import { resolveAuthContext } from "../middlewares/requireAuth";

const clerkClientInstance = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const router: IRouter = Router();

router.get("/auth/me", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId ?? null;

  if (!userId) {
    res.json({ isAuthenticated: false, isEditor: false, userId: null, email: null, firstName: null, lastName: null, role: null, team: null });
    return;
  }

  try {
    const clerkUser = await clerkClientInstance.users.getUser(userId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? null;
    const ctx = email ? await resolveAuthContext(userId) : null;
    const isEditor = ctx !== null && (ctx.role === "admin" || ctx.role === "guest");
    res.json({
      isAuthenticated: true,
      isEditor,
      userId,
      email,
      firstName: clerkUser.firstName ?? null,
      lastName: clerkUser.lastName ?? null,
      role: ctx?.role ?? null,
      team: ctx?.team ?? null,
    });
  } catch {
    res.json({ isAuthenticated: true, isEditor: false, userId, email: null, firstName: null, lastName: null, role: null, team: null });
  }
});

export default router;
