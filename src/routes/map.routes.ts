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
<<<<<<< HEAD
router.post("/stations/route", findPath);
//router.post("/trips", findPath);
=======
>>>>>>> a3216038d68739752edc398008b54510fb287371
export default router;
