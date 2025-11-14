import express from "express";
import jwt from "jsonwebtoken";

import LogIn from "./log-in";
import Register from "./register";
import { db } from "../../lib/db";

const router = express.Router();

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

    const user = await db.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) return res.status(404).json({ error: "User not found." });

    const { refreshToken: _, password: __, ...cleanUser } = user;

    res.json({ user: cleanUser });
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError)
      return res
        .status(400)
        .json({ error: "JWT error: the token may be malformed" });

    res.status(500).json({ error: "Internal server error" });
    console.trace(err);
  }
});

router.use(LogIn);
router.use(Register);

export default router;
