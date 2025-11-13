import express from "express";
import { PrismaClient } from "../../../generated/prisma";

const router = express.Router();
const db = new PrismaClient();

router.get<{ q: string }>("/search", async (req, res) => {
  const query = req.query.q as string;

  if (!query) return res.status(400).json({ error: "Missing search query" });

  const data = await db.stop.findMany({
    where: {
      name: {
        contains: query,
        mode: "insensitive",
      },
      parent_station_id: {
        equals: null,
      },
    },
    take: 10,
  });

  res.json(data);
});

export default router;
