import express from "express";
import { getStations, getNearestStations } from "../controllers/map.controller";

const router = express.Router();

router.post("/stations", getStations);
router.post("/stations/nearest", getNearestStations);

export default router;
