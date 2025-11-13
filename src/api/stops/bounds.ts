import express from "express";
import { PrismaClient } from "../../../generated/prisma/client";

const router = express.Router();
const db = new PrismaClient();

router.get("/bounds", async (req, res) => {
  const query = req.query;

  if (
    !query.latUpper ||
    !query.latLower ||
    !query.lonUpper ||
    !query.lonLower
  ) {
    res.status(401).json({ error: "Missing params" });
    return;
  }

  // Extract and validate query parameters as strings
  const latUpperStr = Array.isArray(query.latUpper)
    ? query.latUpper[0]
    : query.latUpper;
  const latLowerStr = Array.isArray(query.latLower)
    ? query.latLower[0]
    : query.latLower;
  const lonUpperStr = Array.isArray(query.lonUpper)
    ? query.lonUpper[0]
    : query.lonUpper;
  const lonLowerStr = Array.isArray(query.lonLower)
    ? query.lonLower[0]
    : query.lonLower;

  if (
    !latUpperStr ||
    !latLowerStr ||
    !lonUpperStr ||
    !lonLowerStr ||
    typeof latUpperStr !== "string" ||
    typeof latLowerStr !== "string" ||
    typeof lonUpperStr !== "string" ||
    typeof lonLowerStr !== "string"
  ) {
    res.status(400).json({ error: "Missing or invalid params" });
    return;
  }

  const latUpper = parseFloat(latUpperStr);
  const latLower = parseFloat(latLowerStr);
  const lonUpper = parseFloat(lonUpperStr);
  const lonLower = parseFloat(lonLowerStr);

  // Validate parsed numbers
  if (
    isNaN(latUpper) ||
    isNaN(latLower) ||
    isNaN(lonUpper) ||
    isNaN(lonLower)
  ) {
    res.status(400).json({ error: "Invalid numeric parameters" });
    return;
  }

  const data = await db.stop.findMany({
    where: {
      latitude: {
        gte: latLower,
        lte: latUpper,
      },
      longitude: {
        gte: lonLower,
        lte: lonUpper,
      },
      parent_station_id: { equals: null },
    },
  });

  res.json(data);
});

export default router;
