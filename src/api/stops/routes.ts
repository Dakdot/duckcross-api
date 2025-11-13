import express from "express";
import { PrismaClient } from "../../../generated/prisma/client";

const router = express.Router();
const db = new PrismaClient();

router.get<{ stopId: string }>("/:stopId/routes", async (req, res) => {
  const stopId = req.params.stopId as string;

  const data = await db.route.findMany({
    where: {
      trips: {
        some: {
          stop_times: {
            some: {
              OR: [
                {
                  stop_id: stopId,
                },
                {
                  stop: {
                    parent_station_id: stopId,
                  },
                },
              ],
            },
          },
        },
      },
    },
  });

  res.json(data);
});

export default router;
