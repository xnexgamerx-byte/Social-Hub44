import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storeItemsRouter from "./storeItems";
import vipTiersRouter from "./vipTiers";
import vipFeaturesRouter from "./vipFeatures";
import agoraRouter from "./agora";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storeItemsRouter);
router.use(vipTiersRouter);
router.use(vipFeaturesRouter);
router.use(agoraRouter);

export default router;
