import jwt, { TokenExpiredError } from "jsonwebtoken";
import {
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
} from "../config/auth.config";

export const generateTokens = (userId: string) => {
  // Generate access token
  const accessToken = jwt.sign(
    {
      id: userId,
    },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );

  // Generate refresh token
  const refreshToken = jwt.sign(
    {
      id: userId,
    },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as { id: string };
    return { valid: true, expired: false, id: decoded.id };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return { valid: true, expired: true, id: undefined };
    }
    return { valid: false, expired: false, id: undefined };
  }
};

export const verifyRefreshToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as { id: string };
    return { valid: true, expired: false, id: decoded.id };
  } catch (err) {
    return { valid: false, expired: true, id: undefined };
  }
};
