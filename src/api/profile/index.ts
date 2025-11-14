import express from "express";
import jwt from "jsonwebtoken";
import { db } from "../../lib/db";

const router = express.Router();

router.put("/", async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET)
      throw new Error("No JWT secret was defined!");

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res
        .status(401)
        .json({ error: "Authorization header missing or invalid." });

    const accessToken = authHeader.split(" ")[1];

    const { email } = jwt.verify(
      accessToken,
      process.env.JWT_SECRET || "NO_SECRET"
    ) as { email: string };

    const user = await db.user.findUnique({ where: { email } });

    if (!user) return res.status(404).json({ error: "User not found." });

    const body = req.body as {
      name?: string;
      needsWelcome?: boolean;
      favoriteStations?: string[];
      favoriteLines?: string[];
      notificationSchedule?: {
        monday: boolean;
        tuesday: boolean;
        wednesday: boolean;
        thursday: boolean;
        friday: boolean;
        saturday: boolean;
        sunday: boolean;
      };
    };

    console.log(JSON.stringify(req.body));

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.needsWelcome !== undefined)
      updateData.needsWelcome = body.needsWelcome;
    if (body.favoriteStations !== undefined)
      updateData.favoriteStations = body.favoriteStations;
    if (body.favoriteLines !== undefined)
      updateData.favoriteLines = body.favoriteLines;
    if (body.notificationSchedule !== undefined)
      updateData.notificationSchedule = body.notificationSchedule;

    const profile = await db.profile.update({
      where: { userId: user.id },
      data: updateData,
    });

    if (!profile) return res.status(404).json({ error: "Profile not found." });

    return res.json({ profile });
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError)
      return res
        .status(400)
        .json({ error: "JWT error: the token may be malformed" });

    res.status(500).json({ error: "Internal server error" });
    console.trace(err);
  }
});

router.get("/", async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET)
      throw new Error("No JWT secret was defined!");

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res
        .status(401)
        .json({ error: "Authorization header missing or invalid." });

    const accessToken = authHeader.split(" ")[1];

    const { email } = jwt.verify(
      accessToken,
      process.env.JWT_SECRET || "NO_SECRET"
    ) as { email: string };

    const user = await db.user.findUnique({ where: { email } });

    if (!user) return res.status(404).json({ error: "User not found." });

    const profile = await db.profile.findUnique({
      where: {
        userId: user.id,
      },
    });

    if (!profile)
      return res.status(404).json({
        error: "Profile not found. Has this user gone through setup?",
      });

    res.json({ profile });
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError)
      return res
        .status(400)
        .json({ error: "JWT error: the token may be malformed" });

    res.status(500).json({ error: "Internal server error" });
    console.trace(err);
  }
});

export default router;
