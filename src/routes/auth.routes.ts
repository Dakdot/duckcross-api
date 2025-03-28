import express from "express";
import {
  register,
  login,
  renewAccessToken,
  logout,
} from "../controllers/auth.controller";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/renew-access", renewAccessToken);
router.post("/logout", logout);

export default router;
