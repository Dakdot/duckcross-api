import express from "express";
import {
  getStations,
  getNearestStations,
  getDetails,
  searchHandler,
  findPath,
} from "../controllers/map.controller";

const router = express.Router();

router.post("/stations", getStations);
router.post("/stations/nearest", getNearestStations);
router.post("/stations/details", getDetails);
router.post("/stations/search", searchHandler);
router.post("/stations/route", findPath);
export default router;
