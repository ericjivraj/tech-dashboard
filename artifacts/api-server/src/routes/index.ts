import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminAuthRouter from "./admin-auth";
import cyclesRouter from "./cycles";
import sprintsRouter from "./sprints";
import goalsRouter from "./goals";
import projectsRouter from "./projects";
import summaryRouter from "./summary";
import auditLogRouter from "./auditLog";
import passcodeRouter from "./passcode";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminAuthRouter);
router.use(passcodeRouter);
router.use(cyclesRouter);
router.use(sprintsRouter);
router.use(goalsRouter);
router.use(projectsRouter);
router.use(summaryRouter);
router.use(auditLogRouter);

export default router;
