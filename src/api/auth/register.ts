// register.ts
// Created by Thiago on 11/12/25

import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../../lib/db";

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET)
      throw new Error("No JWT secret was defined!");

    console.log(JSON.stringify(req.body));

    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Missing fields" });

    const hashedPassword = await bcrypt.hash(password, 12);

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

    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        refreshToken,
        refreshTokenCreatedAt: new Date(),
        profile: {
          create: {
            needsWelcome: true,
            notificationSchedule: {
              create: {
                monday: true,
                tuesday: true,
                wednesday: true,
                thursday: true,
                friday: true,
                saturday: false,
                sunday: false,
              },
            },
          },
        },
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
      message: "Registration was successful.",
      user: userClean,
      accessToken,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
    console.trace(err);
  }
});

export default router;
