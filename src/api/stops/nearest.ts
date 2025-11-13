import express from "express";
import { PrismaClient } from "../../../generated/prisma";

const router = express.Router();
const db = new PrismaClient();

type NearestStationsParams = {
  lat: string;
  lon: string;
  radius?: string;
  agencies?: string | string[];
  page?: string;
  pageSize?: string;
};

router.get<NearestStationsParams, any>("/nearby", async (req, res) => {
  const lat = req.query.lat;
  const lon = req.query.lon;

  const page = parseInt(req.query.page as string) || 0;
  let pageSize = parseInt(req.query.pageSize as string);

  // Protect from having a really large page size
  if (pageSize > 50) pageSize = 50;
  if (!pageSize) pageSize = 30;

  if (!lat || !lon) {
    res.status(400).json({ error: "Missing required parameters: lat and lon" });
    return;
  }

  const radius = req.query.radius
    ? parseFloat(req.query.radius as string)
    : 1000; // Default 1km radius
  const agencies = req.query.agencies
    ? Array.isArray(req.query.agencies)
      ? req.query.agencies
      : [req.query.agencies]
    : undefined;

  // Convert coordinates to numbers
  const latitude = parseFloat(lat as string);
  const longitude = parseFloat(lon as string);

  // Validate coordinates
  if (isNaN(latitude) || isNaN(longitude)) {
    res.status(400).json({ error: "Invalid coordinates provided" });
    return;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    res.status(400).json({ error: "Coordinates out of valid range" });
    return;
  }

  // Haversine formula to calculate distance between two points
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  };

  // Build where clause for agency filtering
  const whereClause: any = {};
  if (agencies && agencies.length > 0) {
    whereClause.agencies = {
      some: {
        agency: {
          id: {
            in: agencies,
          },
        },
      },
    };
  }

  // Get all stops (with agency filter if specified)
  const stops = await db.stop.findMany({
    where: whereClause,
    include: {},
    skip: page * pageSize,
    take: pageSize,
  });

  // Calculate distances and filter by radius
  const stopsWithDistance = stops
    .filter((stop) => !!stop.latitude && !!stop.longitude)
    .map((stop) => ({
      ...stop,
      distance: calculateDistance(
        latitude,
        longitude,
        stop.latitude as number,
        stop.longitude as number
      ),
    }))
    .filter((stop) => stop.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 50); // Limit to 50 nearest stops

  const data = stopsWithDistance.map((stop) => ({
    id: stop.id,
    code: stop.code,
    name: stop.name,
    description: stop.description,
    latitude: stop.latitude,
    longitude: stop.longitude,
    distance: Math.round(stop.distance * 1000), // Convert to meters and round
  }));

  res.json({
    stops: data,
    count: data.length,
    radius: radius,
    center: {
      latitude,
      longitude,
    },
    page: page,
  });
});

export default router;
