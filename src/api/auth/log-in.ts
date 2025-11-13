import express from "express";
import bcrypt from "bcrypt";
import { db } from "../../lib/db";
import jwt from "jsonwebtoken";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET)
      throw new Error("No JWT secret was defined!");

    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Missing credentials" });

    let user = await db.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);

    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const accessToken = jwt.sign(
      { email },
      process.env.JWT_SECRET || "NO_SECRET",
      { expiresIn: "30m" }
    );
    const refreshToken = jwt.sign(
      { email },
      process.env.JWT_SECRET || "NO_SECRET",
      { expiresIn: "30d" }
    );

    user = await db.user.update({
      where: { email },
      data: {
        refreshToken,
        refreshTokenCreatedAt: new Date(),
      },
    });

    res.cookie("DC_REFRESH_TOKEN", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/v1/auth/refresh",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    // Omit refreshToken and password from user object
    const { refreshToken: _, password: __, ...userClean } = user;
    res.json({
      message: "Log in was successful.",
      user: userClean,
      accessToken,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
    console.trace(err);
  }
});

export default router;
