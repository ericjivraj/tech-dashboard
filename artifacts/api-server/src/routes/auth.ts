import { Router, type IRouter } from "express";
import { getAuth, createClerkClient } from "@clerk/express";

const clerkClientInstance = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const router: IRouter = Router();

router.get("/auth/me", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId ?? null;

  if (!userId) {
    res.json({ isAuthenticated: false, userId: null, email: null, firstName: null, lastName: null });
    return;
  }

  try {
    const user = await clerkClientInstance.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress ?? null;
    res.json({
      isAuthenticated: true,
      userId,
      email,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
    });
  } catch {
    res.json({ isAuthenticated: true, userId, email: null, firstName: null, lastName: null });
  }
});

export default router;
