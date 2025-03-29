import express from "express";
import {
  getStations,
  getNearestStations,
  getDetails,
  searchHandler,
} from "../controllers/map.controller";

const router = express.Router();

router.post("/stations", getStations);
router.post("/stations/nearest", getNearestStations);
router.post("/stations/details", getDetails);
router.post("/stations/search", searchHandler);
export default router;
