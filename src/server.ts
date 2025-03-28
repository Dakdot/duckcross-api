import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { verifyToken } from "./middleware/auth.middleware";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import mapRoutes from "./routes/map.routes";

const app = express();
const PORT = process.env.PORT || 3000;

console.log(
  `Server starting... node environment is ${process.env.NODE_ENV?.toUpperCase()}`
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true, // Enable credentials (cookies)
  })
);
app.use(express.json());
app.use(cookieParser());
// TODO: Fix this -- it doesn't work in production
if (process.env.NODE_ENV === "production") app.use(morgan("combined"));
else app.use(morgan("dev"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", verifyToken, userRoutes); // uses verifyToken middleware
app.use("/api/map", mapRoutes); // unprotected for now

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
