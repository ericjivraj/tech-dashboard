import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminAuthRouter from "./admin-auth";
import sprintsRouter from "./sprints";
import goalsRouter from "./goals";
import projectsRouter from "./projects";
import summaryRouter from "./summary";
import auditLogRouter from "./auditLog";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminAuthRouter);
router.use(sprintsRouter);
router.use(goalsRouter);
router.use(projectsRouter);
router.use(summaryRouter);
router.use(auditLogRouter);

export default router;
