import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storeItemsRouter from "./storeItems";
import vipTiersRouter from "./vipTiers";
import vipFeaturesRouter from "./vipFeatures";
import agoraRouter from "./agora";
import coinPackagesRouter from "./coinPackages";
import dailyTasksRouter from "./dailyTasks";
import walletRouter from "./wallet";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storeItemsRouter);
router.use(vipTiersRouter);
router.use(vipFeaturesRouter);
router.use(agoraRouter);
router.use(coinPackagesRouter);
router.use(dailyTasksRouter);
router.use(walletRouter);

export default router;
