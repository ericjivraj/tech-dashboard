import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

function isValidRole(role: unknown): role is "admin" | "guest" {
  return role === "admin" || role === "guest";
}

router.get("/users", requireRole(["admin"]), async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(users);
});

router.post("/users", requireRole(["admin"]), async (req, res): Promise<void> => {
  const { email, clerkUserId, role, team } = req.body ?? {};
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "email is required" });
    return;
  }
  if (!isValidRole(role)) {
    res.status(400).json({ error: "role must be 'admin' or 'guest'" });
    return;
  }
  const clerkUserIdValue = typeof clerkUserId === "string" && clerkUserId.length > 0 ? clerkUserId : null;
  const teamValue = typeof team === "string" && team.length > 0 ? team : null;
  try {
    const [user] = await db
      .insert(usersTable)
      .values({ email: email.toLowerCase(), clerkUserId: clerkUserIdValue, role, team: teamValue })
      .returning();
    res.status(201).json(user);
  } catch {
    res.status(409).json({ error: "A user with this email already exists" });
  }
});

router.patch("/users/:id", requireRole(["admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  const { role, team } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (role !== undefined) {
    if (!isValidRole(role)) {
      res.status(400).json({ error: "role must be 'admin' or 'guest'" });
      return;
    }
    updates.role = role;
  }
  if (team !== undefined) {
    updates.team = typeof team === "string" && team.length > 0 ? team : null;
  }
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

router.delete("/users/:id", requireRole(["admin"]), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  const [user] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
