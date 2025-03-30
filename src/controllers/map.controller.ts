import { Prisma, PrismaClient } from "@prisma/client";
import express, { Request, Response } from "express";
import { TransitRouteFinder as TransitRouteFinderImpl } from "../transit-route-finder";
import { z } from "zod";
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
        message: 'Both "from" and "to" stop IDs are required',
      });
      return;
    }

    console.log(
      `Finding routes from stop "${fromStopId}" to stop "${toStopId}"`
    );

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
        message: `Origin stop ID "${fromStopId}" not found`,
      });
      return;
    }

    if (toStopName === toStopId) {
      res.status(404).json({
        success: false,
        message: `Destination stop ID "${toStopId}" not found`,
      });
      return;
    }

    // Find paths directly using the stop IDs
    const routes = routeFinder.findPaths([fromStopId], [toStopId], maxPaths);

    // Format and return results
    if (routes.length > 0) {
      const formattedRoutes = routes.map((route: PathResult, index: number) => {
        // Format the route with station names
        const stopsWithNames = route.path.map((stopId: string) => ({
          id: stopId,
          name: routeFinder.getStationName(stopId),
        }));

        // Format transfer points with names
        const transfersWithNames = route.transferPoints.map(
          (stopId: string) => ({
            id: stopId,
            name: routeFinder.getStationName(stopId),
          })
        );

        return {
          routeNumber: index + 1,
          totalStops: route.path.length,
          stops: stopsWithNames,
          totalTime: route.totalTime,
          transfers: route.transfers,
          transferPoints: transfersWithNames,
        };
      });

      res.status(200).json({
        success: true,
        routes: formattedRoutes,
        from: {
          id: fromStopId,
          name: fromStopName,
        },
        to: {
          id: toStopId,
          name: toStopName,
        },
        routesFound: routes.length,
      });
      return;
    } else {
      res.status(404).json({
        success: false,
        message: `No routes found between stop "${fromStopId}" and stop "${toStopId}"`,
        from: {
          id: fromStopId,
          name: fromStopName,
        },
        to: {
          id: toStopId,
          name: toStopName,
        },
      });
      return;
    }
  } catch (error) {
    console.error("Failed to find routes:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error while finding routes",
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }
};
export const searchHandler: express.RequestHandler = async (req, res) => {
  const { q } = req.query;

  if (!q) {
    res.status(400).json({ error: "No query specified" });
  }

  const results = await db.stop.findMany({
    where: {
      name: {
        contains: q?.toString(),
        mode: "insensitive",
      },
      location_type: 1,
    },
    take: 10,
  });

  res.status(200).json({ query: q?.toString(), results });
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
    req.query;

  const schema = z.object({
    latLowerBound: z.coerce.number().gte(-90).lte(90),
    latUpperBound: z.coerce.number().gte(-90).lte(90),
    lonLowerBound: z.coerce.number().gte(-180).lte(180),
    lonUpperBound: z.coerce.number().gte(-180).lte(180),
  });

  const { success, data, error } = schema.safeParse({
    latLowerBound,
    latUpperBound,
    lonLowerBound,
    lonUpperBound,
  });

  if (!success || !data || error) {
    res.status(400).json({
      error: {
        message: "One or more parameters failed validation",
        issues: error.issues,
      },
    });
    return;
  }

  const stations = await db.stop.findMany({
    where: {
      lat: {
        gte: data.latLowerBound,
        lte: data.latUpperBound,
      },
      lon: {
        gte: data.lonLowerBound,
        lte: data.latUpperBound,
      },
      location_type: 1,
    },
  });

  res.status(200).json({ results: stations, length: stations.length });
};

export const getNearestStations: express.RequestHandler = async (
  req: Request,
  res: Response
) => {
  const { lat, lon, count = 5 } = req.query;

  const schema = z.object({
    lat: z.coerce.number().gte(-90).lte(90),
    lon: z.coerce.number().gte(-90).lte(90),
    count: z.coerce.number().gte(1).lte(20),
  });

  const { success, data, error } = schema.safeParse({
    lat,
    lon,
    count,
  });

  if (!success || !data || error) {
    res.status(400).json({
      error: {
        message: "One or more parameters failed validation",
        issues: error.issues,
      },
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
        ST_MakePoint(${data.lon}, ${data.lat})::geography
      ) AS distance_meters
    FROM 
      "Stop"
    ORDER BY 
      distance_meters ASC
    LIMIT ${data.count};
  `;

  res.status(200).json({ result });
};
