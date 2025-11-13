import express from "express";
import { PrismaClient } from "../../../generated/prisma";

const router = express.Router();
const db = new PrismaClient();

router.get<{ stopId: string }>("/:stopId/arrivals", async (req, res) => {
  const stopId = req.params.stopId;
  const now = new Date();
  const currentTime = now.toTimeString().split(" ")[0];
  const dayOfWeek = now.getDay();

  const stop = await db.stop.findFirst({
    where: {
      id: stopId,
    },
  });

  if (!stop) {
    return res.status(404).json({ error: `Stop with ID ${stopId} not found` });
  }

  const data = await db.stopTime.findMany({
    where: {
      arrival_time: {
        gte: currentTime,
      },
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
      sequence: {
        not: 1,
      },
      trip: {
        service: {
          start_date: {
            lte: now,
          },
          end_date: {
            gte: now,
          },
          OR: [
            {
              ...(dayOfWeek === 0 && { sunday: true }),
              ...(dayOfWeek === 1 && { monday: true }),
              ...(dayOfWeek === 2 && { tuesday: true }),
              ...(dayOfWeek === 3 && { wednesday: true }),
              ...(dayOfWeek === 4 && { thursday: true }),
              ...(dayOfWeek === 5 && { friday: true }),
              ...(dayOfWeek === 6 && { saturday: true }),
            },
            {
              exceptions: {
                some: {
                  date: now,
                },
              },
            },
          ],
        },
      },
    },
    orderBy: {
      arrival_time: "asc",
    },
    include: {
      trip: {
        include: {
          route: true,
        },
      },
    },
    take: 20,
  });

  res.json({
    stop: {
      ...stop,
    },
    arrivals: [...data],
  });
});

export default router;
