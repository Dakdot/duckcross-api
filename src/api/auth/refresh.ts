import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

router.post("/refresh", (req, res) => {
  const refreshToken = req.cookies("DC_REFRESH_TOKEN");

  if (!refreshToken) return res.status(400).json({ error: "No refresh token" });

  try {
    if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET)
      throw new Error("No JWT secret was defined!");

    const { email } = jwt.verify(
      refreshToken,
      process.env.JWT_SECRET || "NO_SECRET"
    ) as { email: string };

    const accessToken = jwt.sign(
      { email },
      process.env.JWT_SECRET || "NO_SECRET",
      {
        expiresIn: "30m",
      }
    );

    res.json({ message: "New access token created.", accessToken });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
    console.trace(err);
  }
});

export default router;
