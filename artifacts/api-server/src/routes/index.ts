import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import storeItemsRouter from "./storeItems";
import vipTiersRouter from "./vipTiers";
import vipFeaturesRouter from "./vipFeatures";
import agoraRouter from "./agora";
import coinPackagesRouter from "./coinPackages";
import dailyTasksRouter from "./dailyTasks";
import walletRouter from "./wallet";
import adminsRouter from "./admins";
import roomsRouter from "./rooms";
import dmRouter from "./dm";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storeItemsRouter);
router.use(vipTiersRouter);
router.use(vipFeaturesRouter);
router.use(agoraRouter);
router.use(coinPackagesRouter);
router.use(dailyTasksRouter);
router.use(walletRouter);
router.use(adminsRouter);
router.use(roomsRouter);
router.use(dmRouter);

export default router;
