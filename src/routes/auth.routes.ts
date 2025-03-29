import express from "express";
import {
  register,
  login,
  renewAccessToken,
  logout,
  getAuthenticatedUser,
} from "../controllers/auth.controller";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/renew-access-token", renewAccessToken);
router.post("/logout", logout);
router.post("/get-authenticated-user", getAuthenticatedUser);

export default router;
