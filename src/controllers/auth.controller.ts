import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrpyt from "bcrypt";
import { generateTokens, verifyRefreshToken } from "../utils/token.utils";
import * as z from "zod";

const db = new PrismaClient();

export const register: express.RequestHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { name, email, password, role = "user" } = req.body;

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrpyt.hash(password, 10);

    // Create user
    let user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
        profile: {
          create: {
            name,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Store refresh token in database
    await db.user.update({
      where: { id: user.id },
      data: { refreshToken, refreshTokenCreatedAt: new Date() },
    });

    // Set refresh token as HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Use secure in production
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // TODO: Make this correspond with configured age
    });

    // Remove password form response
    const {
      password: _,
      refreshToken: __,
      refreshTokenCreatedAt: ___,
      ...userData
    } = user;

    res.status(200).json({
      message: "User registered successfully",
      user: userData,
      accessToken,
    });
  } catch (err) {
    res.status(500).json({ error: `User registration failed ${err}` });
  }
};

export const login: express.RequestHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { email, password } = req.body;

    const schema = z.object({
      email: z.string(),
      password: z.string(),
    });

    const { success, data, error } = schema.safeParse({ email, password });

    if (!data || !success || error) {
      res
        .status(400)
        .json({
          error: "One or more parameters failed validation",
          description: error.issues,
        });
      return;
    }

    // Find user
    const user = await db.user.findUnique({
      where: { email },
      include: {
        profile: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Check password
    const isPasswordValid = await bcrpyt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    await db.user.update({
      where: { id: user.id },
      data: { refreshToken, refreshTokenCreatedAt: new Date() },
    });

    // Set refresh token as HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, TODO: Make this correspond to configured age
    });

    // Remove password from response
    const { password: _, refreshToken: __, ...userData } = user;

    res.status(200).json({
      user: userData,
      accessToken,
    });
  } catch (err) {
    res.status(500).json({ error: `Login failed` });
    console.error(err);
  }
};

export const renewAccessToken: express.RequestHandler = async (
  req: Request,
  res: Response
) => {
  try {
    // Get refresh token form cookie or request body
    const token = req.cookies.refreshToken || req.body.refreshToken;

    if (!token) {
      res.status(404).json({ valid: false, error: "Refresh token not found" });
      return;
    }

    // Verify refresh token
    const { valid, id } = verifyRefreshToken(token);

    if (!valid) {
      res.status(401).json({ valid: false, error: "Invalid refresh token" });
      return;
    }

    // Find user with the refresh token
    const user = await db.user.findFirst({
      where: {
        id,
        refreshToken: token,
      },
    });

    if (!user) {
      res
        .status(401)
        .json({ valid: false, error: "Refresh token invalid or expired" });
      return;
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user.id
    );

    await db.user.update({
      where: { id: user.id },
      data: {
        refreshToken: newRefreshToken,
        refreshTokenCreatedAt: new Date(),
      },
    });

    // Set new refresh token as HTTP-only cookie
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, TODO: Make this correspond with configured age
    });

    res.json({ valid: true, token: accessToken });
  } catch (err) {
    res
      .status(500)
      .json({ valid: false, error: "Renewal of access token failed" });
  }
};

export const logout: express.RequestHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;

    if (!token) {
      res.status(401).json({ error: "Refresh token not found" });
      return;
    }

    const user = await db.user.findFirst({
      where: { refreshToken: token },
    });

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    // Clear the refresh token in the database
    await db.user.update({
      where: { id: user.id },
      data: { refreshToken: null },
    });

    res.clearCookie("refreshToken");

    res.status(200).json({ message: "Logout successful" });
  } catch (err) {
    res.status(500).json({ error: "Logout failed" });
  }
};

export const getAuthenticatedUser: express.RequestHandler = async (
  req: Request,
  res: Response
) => {
  try {
    // Get refresh token form cookie or request body
    const token = req.cookies.refreshToken || req.body.refreshToken;

    if (!token) {
      res.status(401).json({ valid: false, error: "Refresh token not found" });
      return;
    }

    // Verify refresh token
    const { valid, id } = verifyRefreshToken(token);

    if (!valid) {
      res.status(401).json({ valid: false, error: "Invalid refresh token" });
      return;
    }

    // Find user with the refresh token
    const user = await db.user.findFirst({
      where: {
        id,
        refreshToken: token,
      },
      include: {
        profile: true,
      },
    });

    if (!user) {
      res
        .status(401)
        .json({ valid: false, error: "Refresh token invalid or expired" });
      return;
    }

    // Remove password from response
    const { password, refreshToken, ...userData } = user;

    res.status(200).json({ user: userData });
  } catch (err) {
    res.status(500).json({ error: "Failed to get user" });
  }
};
