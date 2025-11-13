import express from "express";

import routeId from "./routeId";
import RouteShapes from "./shapes";

const router = express.Router();

router.use("/:routeId", routeId);
router.use(RouteShapes);

export default router;
