import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storeItemsRouter from "./storeItems";
import vipTiersRouter from "./vipTiers";
import vipFeaturesRouter from "./vipFeatures";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storeItemsRouter);
router.use(vipTiersRouter);
router.use(vipFeaturesRouter);

export default router;
