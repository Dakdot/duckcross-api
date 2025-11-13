import express from "express";
import { PrismaClient } from "../../../generated/prisma/client";

const router = express.Router({ mergeParams: true });
const db = new PrismaClient();

type RouteIdResponse = any;

router.get<{ routeId: string }, RouteIdResponse>("/", async (req, res) => {
  const routeId = req.params.routeId;

  const data = await db.route.findUnique({
    where: {
      id: routeId,
    },
    include: {
      agency: true,
    },
    omit: {
      agency_id: true,
    },
  });

  if (!data) {
    res.status(404).json({
      error: `Route with ID ${routeId} not found.`,
    });
    return;
  }

  res.json(data);
});

export default router;
