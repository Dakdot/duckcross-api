import express from "express";
import {
  getStations,
  getNearestStations,
  getDetails,
  searchHandler,
  findPath,
} from "../controllers/map.controller";

const router = express.Router();

router.get("/stations", getStations);
router.get("/stations/nearest", getNearestStations);
router.get("/stations/details", getDetails);
router.get("/stations/search", searchHandler);
router.get("/stations/route", findPath);
export default router;
