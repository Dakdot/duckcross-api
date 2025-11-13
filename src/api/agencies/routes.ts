import express from "express";
import { PrismaClient } from "../../../generated/prisma";

const router = express.Router();
const db = new PrismaClient();

router.get<{ agencyId: string }, any>("/:agencyId/routes", async (req, res) => {
  const agencyId = req.params.agencyId;

  const data = await db.route.findMany({
    where: {
      agency_id: agencyId,
    },
    omit: {
      agency_id: true,
    },
  });

  return res.json(data);
});

export default router;
