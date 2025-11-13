import express from "express";
import { PrismaClient } from "../../../generated/prisma";

const router = express.Router();
const db = new PrismaClient();

router.get<{ stopId: string }, any>("/:stopId", async (req, res) => {
  try {
    const stopId = req.params.stopId;

    const stop = await db.stop.findFirst({
      where: {
        id: stopId,
      },
      include: {
        child_stations: true,
      },
    });

    if (!stop) return res.status(404).json({ error: "Not found" });

    const agencies = await db.agency.findMany({
      where: {
        routes: {
          some: {
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
        },
      },
    });

    const routes = await db.route.findMany({
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

    res.json({
      ...stop,
      agencies,
      routes,
    });
  } catch (err) {
    res.status(500).json({
      error:
        "An internal error has occurred. Please report this incident to the developers.",
    });
  }
});

export default router;
