export const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || "ACCESS_TOKEN_SECRET_NOT_SET";
export const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "REFRESH_TOKEN_SECRET_NOT_SET";

export const ACCESS_TOKEN_EXPIRES_IN = "15m"; // Short lived
export const REFRESH_TOKEN_EXPIRES_IN = "7d"; // Long lived
