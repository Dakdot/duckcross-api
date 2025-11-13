import express from "express";
import { PrismaClient } from "../../../generated/prisma";

import routes from "./routes";
import stops from "./stops";

const router = express.Router();
const db = new PrismaClient();

router.get("/", async (req, res) => {
  const data = await db.agency.findMany();

  res.json(data);
});

router.use(routes);
router.use(stops);

export default router;
