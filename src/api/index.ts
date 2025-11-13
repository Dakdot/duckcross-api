import express from "express";

import agencies from "./agencies";
import routes from "./routes";
import stops from "./stops";
import auth from "./auth";

const router = express.Router();

router.get<{}, {}>("/", (req, res) => {
  res.send();
});

router.use("/agencies", agencies);
router.use("/routes", routes);
router.use("/stops", stops);
router.use("/auth", auth);

export default router;
