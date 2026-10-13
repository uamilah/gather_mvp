import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eventsRouter from "./events";
import slackRouter from "./slack";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eventsRouter);
router.use(slackRouter);

export default router;
