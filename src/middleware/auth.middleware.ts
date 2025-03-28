import express, { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/token.utils";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
    }
  }
}

export const verifyToken: express.RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  const accessToken = authHeader.split(" ")[1];

  const { valid, expired, id } = verifyAccessToken(accessToken);

  if (!valid) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  if (expired) {
    res.status(401).json({
      error: "Access token expired",
      code: "TOKEN_EXPIRED",
    });
    return;
  }

  const user = await db.user.findUnique({
    where: { id },
  });

  if (!user) {
    res.status(403).json({ error: "Invalid user" });
    return;
  }

  req.userId = user.id;
  req.userRole = user.role;

  next();
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.userRole !== "admin") {
    res.status(403).json({ error: "Permission denied" });
    return;
  }
  next();
};
