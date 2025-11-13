import express from "express";
import { PrismaClient } from "../../../generated/prisma";

const router = express.Router();
const db = new PrismaClient();

router.get<{ agencyId: string }, any>("/:agencyId/stops", async (req, res) => {
  const agencyId = req.params.agencyId;

  const data = await db.stop.findMany({
    where: {
      stop_times: {
        some: {
          trip: {
            route: {
              agency_id: agencyId,
            },
          },
        },
      },
    },
  });

  res.json(data);
});

export default router;
