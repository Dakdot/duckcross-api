import { Prisma, PrismaClient } from "@prisma/client";
import express, { Request, Response } from "express";
import { TransitRouteFinder as TransitRouteFinderImpl } from '../transit-route-finder';
const db = new PrismaClient();

interface ParameterError {
  parameter: string;
  error: string;
}
export const searchHandler: express.RequestHandler = async (req, res) => {
  // note to self: this accecpts stations/search?query=search term
  const { q } = req.query;
  const queryString = q as string;

  // Validate the query string
  if (!queryString) {
    res.status(400).json({
      error: "Missing query string",
    });
    return;
  }

  // Find parent stops matching the search criteria
  const parentStops = await db.stop.findMany({
    where: {
      name: {
        contains: queryString,
        mode: "insensitive",
      },
      location_type: 1, // Only parent stops
    },
    include: {
      child_stops: true, // Include child stops to query their stop times
    },
  });

  // Get all child stop IDs for the matching parent stops
  const childStopIds = parentStops.flatMap(
    (parentStop: { child_stops: any[] }) =>
      parentStop.child_stops.map((child: { id: string }) => child.id)
  );

  // Get all routes serving these child stops through stop times and trips
  interface RouteByStopId {
    parent_stop_id: string;
    route_id: string;
    short_name: string;
  }

  const routesByStopId = await db.$queryRaw<RouteByStopId[]>`
    SELECT DISTINCT 
      s.parent_stop_id, 
      r.id as route_id, 
      r.short_name
    FROM "Stop" s
    JOIN "StopTime" st ON s.id = st.stop_id
    JOIN "Trip" t ON st.trip_id = t.id
    JOIN "Route" r ON t.route_id = r.id
    WHERE s.id IN (${Prisma.sql`${childStopIds
      .map((id: string) => `'${id}'`)
      .join(",")}`})
  `;

  // Group routes by parent stop ID
  const routesByParentId: {
    [key: string]: { id: string; short_name: string }[];
  } = {};
  for (const row of routesByStopId) {
    if (!routesByParentId[row.parent_stop_id]) {
      routesByParentId[row.parent_stop_id] = [];
    }

    // Check if this route is already added to avoid duplicates
    const routeExists = routesByParentId[row.parent_stop_id].some(
      (route) => route.id === row.route_id
    );

    if (!routeExists) {
      routesByParentId[row.parent_stop_id].push({
        id: row.route_id,
        short_name: row.short_name,
      });
    }
  }

  // Format the results in the desired structure
  const results = parentStops.map(
    (station: { id: string; name: string; lat: number; lon: number }) => ({
      id: station.id,
      name: station.name,
      lat: station.lat,
      lon: station.lon,
      routesServed: routesByParentId[Number(station.id)] || [],
    })
  );

  res.status(200).json({ queryString, results });
};

export const getDetails: express.RequestHandler = async (req, res) => {
  const { station } = req.body;

  const stationInfo = await db.stop.findMany({
    take: 1,
    where: {
      id: {
        equals: station,
        mode: "insensitive",
      },
    },
    select: {
      name: true,
      lat: true,
      lon: true,
    },
  });
  const agencyinfo = await db.agency.findMany({
    take: 1,
    where: {
      id: {
        equals: "MTA NYCT",
      },
    },
    select: {
      name: true,
      url: true,
    },
  });
  res.status(200).json({ stationInfo, agencyinfo });
};
export const getStations: express.RequestHandler = async (
  req: Request,
  res: Response
) => {
  const { latLowerBound, latUpperBound, lonLowerBound, lonUpperBound } =
    req.body;

  let badParams: ParameterError[] = [];

  // TODO: Extract this validation logic into a helper function
  if (!latLowerBound)
    badParams.push({ parameter: "latLowerBound", error: "Missing parameter" });
  if (!latUpperBound)
    badParams.push({ parameter: "latUpperBound", error: "Missing parameter" });
  if (!lonLowerBound)
    badParams.push({ parameter: "lonLowerBound", error: "Missing parameter" });
  if (!lonUpperBound)
    badParams.push({ parameter: "lonUpperBound", error: "Missing parameter" });

  if (latLowerBound > latUpperBound)
    badParams.push({
      parameter: "latLowerBound",
      error: "Lower bound must be less than upper bound",
    });
  if (lonLowerBound > lonUpperBound)
    badParams.push({
      parameter: "lonLowerBound",
      error: "Lower bound must be less than upper bound",
    });

  if (latLowerBound < -90 || latLowerBound > 90)
    badParams.push({
      parameter: "latLowerBound",
      error: "Latitude must be between -90 and 90",
    });
  if (latUpperBound < -90 || latUpperBound > 90)
    badParams.push({
      parameter: "latUpperBound",
      error: "Latitude must be between -90 and 90",
    });
  if (lonLowerBound < -180 || lonLowerBound > 180)
    badParams.push({
      parameter: "lonLowerBound",
      error: "Longitude must be between -180 and 180",
    });
  if (lonUpperBound < -180 || lonUpperBound > 180)
    badParams.push({
      parameter: "lonUpperBound",
      error: "Longitude must be between -180 and 180",
    });

  if (badParams.length > 0) {
    res.status(400).json({
      error: "One or more parameters failed validation",
      description: badParams,
    });
    return;
  }

  const stations = await db.stop.findMany({
    where: {
      lat: {
        gte: latLowerBound,
        lte: latUpperBound,
      },
      lon: {
        gte: lonLowerBound,
        lte: lonUpperBound,
      },
      location_type: 1,
    },
  });

  res.status(200).json({ stations });
};

export const getNearestStations: express.RequestHandler = async (
  req: Request,
  res: Response
) => {
  let { lat, lon, count = 5 } = req.body;

  let badParams: ParameterError[] = [];

  if (!lat) badParams.push({ parameter: "lat", error: "Missing parameter" });
  if (!lon) badParams.push({ parameter: "lon", error: "Missing parameter" });
  if (count < 1)
    badParams.push({
      parameter: "count",
      error: "Count must be greater than 0",
    });
  if (count > 20)
    badParams.push({ parameter: "count", error: "Count must be less than 20" });

  if (lat < -90 || lat > 90)
    badParams.push({
      parameter: "lat",
      error: "Latitude must be between -90 and 90",
    });
  if (lon < -180 || lon > 180)
    badParams.push({
      parameter: "lon",
      error: "Longitude must be between -180 and 180",
    });

  if (badParams.length > 0) {
    res.status(400).json({
      error: "One or more parameters failed validation",
      description: badParams,
    });
    return;
  }

  const result = await db.$queryRaw`
    SELECT 
      id,
      name,
      lat,
      lon,
      ST_Distance(
        ST_MakePoint(lon, lat)::geography,
        ST_MakePoint(${lon}, ${lat})::geography
      ) AS distance_meters
    FROM 
      "Stop"
    ORDER BY 
      distance_meters ASC
    LIMIT ${count};
  `;

  res.status(200).json({ result });
};
