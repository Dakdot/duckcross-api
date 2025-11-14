import express from "express";

import AgenciesRouter from "./agencies";
import RoutesRouter from "./routes";
import StopsRouter from "./stops";
import AuthRouter from "./auth";
import ProfileRouter from "./profile";

const router = express.Router();

router.get<{}, {}>("/", (req, res) => {
  res.send();
});

// router.use("/agencies", AgenciesRouter);
// router.use("/routes", RoutesRouter);
// router.use("/stops", StopsRouter);
router.use("/auth", AuthRouter);
router.use("/profile", ProfileRouter);

export default router;
