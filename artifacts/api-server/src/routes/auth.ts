import { Router, type IRouter } from "express";
import { getAuth, createClerkClient } from "@clerk/express";

const clerkClientInstance = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

function resolveIsEditor(email: string): boolean {
  const raw = process.env.EDITOR_EMAILS ?? "";
  const emails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    return process.env.NODE_ENV !== "production";
  }
  return emails.includes(email.toLowerCase());
}

const router: IRouter = Router();

router.get("/auth/me", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId ?? null;

  if (!userId) {
    res.json({ isAuthenticated: false, isEditor: false, userId: null, email: null, firstName: null, lastName: null });
    return;
  }

  try {
    const user = await clerkClientInstance.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress ?? null;
    const isEditor = email ? resolveIsEditor(email) : false;
    res.json({
      isAuthenticated: true,
      isEditor,
      userId,
      email,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
    });
  } catch {
    res.json({ isAuthenticated: true, isEditor: false, userId, email: null, firstName: null, lastName: null });
  }
});

export default router;
