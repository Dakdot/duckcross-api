import express from "express";
import { PrismaClient } from "../../../generated/prisma";
import simplify from "simplify-js";

const router = express.Router();
const db = new PrismaClient();

router.get<{ routeId: string }>("/:routeId/shapes", async (req, res) => {
  const routeId = req.params.routeId;
  const tolerance = parseFloat(req.query.zoomLevel as string) || 0.001;

  const route = await db.route.findFirst({
    where: {
      id: routeId,
    },
  });

  const shapes = await db.shape.findMany({
    where: {
      trips: {
        some: {
          route_id: routeId,
        },
      },
    },
    include: {
      points: true,
    },
  });

  res.json({
    route: {
      ...route,
    },
    shapes,
  });
});

export default router;
