import { Prisma, PrismaClient } from "@prisma/client";
import express, { Request, Response } from "express";
import { TransitRouteFinder as TransitRouteFinderImpl } from '../transit-route-finder';
const db = new PrismaClient();

interface ParameterError {
  parameter: string;
  error: string;
}
interface PathResult {
  path: string[];
  totalTime: number;
  transfers: number;
  transferPoints: string[];
}

interface StopData {
  id: string;
  name: string;
  lat: number;
  lon: number;
  createdAt: Date;
  updatedAt: Date;
  location_type: number | null;
  parent_stop_id: string | null;
}

export const findPath: express.RequestHandler = async (req, res) => {
  try {
    // Extract parameters from query string
    const fromStopId = req.query.from as string;
    const toStopId = req.query.to as string;
    const maxPaths = req.query.maxPaths ? Number(req.query.maxPaths) : 5;

    // Validate required parameters
    if (!fromStopId || !toStopId) {
      res.status(400).json({
        success: false,
        message: 'Both "from" and "to" stop IDs are required'
      });
      return;
    }

    console.log(`Finding routes from stop "${fromStopId}" to stop "${toStopId}"`);
    
    // Create and initialize the route finder
    const routeFinder = new TransitRouteFinderImpl(db);

    // Process all the data
    await routeFinder.processStops();
    await routeFinder.processStopTimes();
    await routeFinder.processTransfers();

    // Confirm stops exist
    const fromStopName = routeFinder.getStationName(fromStopId);
    const toStopName = routeFinder.getStationName(toStopId);

    if (fromStopName === fromStopId) {
      res.status(404).json({
        success: false,
        message: `Origin stop ID "${fromStopId}" not found`
      });
      return;
    }

    if (toStopName === toStopId) {
      res.status(404).json({
        success: false,
        message: `Destination stop ID "${toStopId}" not found`
      });
      return;
    }

    // Find paths directly using the stop IDs
    const routes = routeFinder.findPaths(
      [fromStopId],
      [toStopId],
      maxPaths
    );

    // Format and return results
    if (routes.length > 0) {
      const formattedRoutes = routes.map((route: PathResult, index: number) => {
        // Format the route with station names
        const stopsWithNames = route.path.map((stopId: string) => ({
          id: stopId,
          name: routeFinder.getStationName(stopId)
        }));

        // Format transfer points with names
        const transfersWithNames = route.transferPoints.map((stopId: string) => ({
          id: stopId,
          name: routeFinder.getStationName(stopId)
        }));

        return {
          routeNumber: index + 1,
          totalStops: route.path.length,
          stops: stopsWithNames,
          totalTime: route.totalTime,
          transfers: route.transfers,
          transferPoints: transfersWithNames
        };
      });

      res.status(200).json({
        success: true,
        routes: formattedRoutes,
        from: {
          id: fromStopId,
          name: fromStopName
        },
        to: {
          id: toStopId,
          name: toStopName
        },
        routesFound: routes.length
      });
      return;
    } else {
      res.status(404).json({
        success: false,
        message: `No routes found between stop "${fromStopId}" and stop "${toStopId}"`,
        from: {
          id: fromStopId,
          name: fromStopName
        },
        to: {
          id: toStopId,
          name: toStopName
        }
      });
      return;
    }
  } catch (error) {
    console.error("Failed to find routes:", error);
    
    res.status(500).json({
      success: false,
      message: "Internal server error while finding routes",
      error: error instanceof Error ? error.message : String(error)
    });
    return;
  }
};
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
  const { station } = req.query;

  const stationInfo = await db.stop.findMany({
    take: 1,
    where: {
      id: {
        equals: String(station),
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
