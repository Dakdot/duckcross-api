import express from "express";
import { PrismaClient } from "../../../generated/prisma";

import NearbyStopsRoute from "./nearest";
import StopIdRoute from "./stopId";
import BoundedRoutes from "./bounds";
import SearchStops from "./search";
import StopRoutes from "./routes";
import StopDepartures from "./departures";
import StopArrivals from "./arrivals";

const router = express.Router();
const db = new PrismaClient();

router.get("/", async (req, res) => {
  const page = parseInt(req.query.page as string) || 0;

  const data = await db.stop.findMany({
    where: {
      parent_station_id: { equals: null },
    },
    skip: page * 50,
    take: 50,
  });

  res.json(data);
});

router.use(SearchStops);
router.use(NearbyStopsRoute);
router.use(BoundedRoutes);
router.use(StopRoutes);
router.use(StopDepartures);
router.use(StopArrivals);
router.use(StopIdRoute);

export default router;
