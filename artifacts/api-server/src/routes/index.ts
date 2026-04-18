import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import cyclesRouter from "./cycles";
import sprintsRouter from "./sprints";
import goalsRouter from "./goals";
import projectsRouter from "./projects";
import summaryRouter from "./summary";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(cyclesRouter);
router.use(sprintsRouter);
router.use(goalsRouter);
router.use(projectsRouter);
router.use(summaryRouter);

export default router;
