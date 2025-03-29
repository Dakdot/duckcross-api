import { PrismaClient } from '@prisma/client';

interface Stop {
  trip_id: string;
  stop_id: string;
  arrival_time: string;
  stop_sequence: number;
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

interface Transfer {
  from_stop_id: string;
  to_stop_id: string;
  transfer_type: number;
  min_transfer_time?: number;
}

interface PathResult {
  path: string[];
  totalTime: number;
  transfers: number;
  transferPoints: string[];
}

interface DirectLine {
  trip_id: string;
  stops: string[];
  travelTimes: Map<string, number>; // Maps "stopA-stopB" to time in minutes
}

class TransitRouteFinder {
  private stopsByLine: Map<string, Set<string>> = new Map(); // Maps trip_id to set of stop_ids
  private stopConnections: Map<string, Set<string>> = new Map(); // Maps stop_id to set of directly connected stop_ids
  private stationNames: Map<string, string> = new Map(); // Maps stop_id to station name
  private transferOptions: Map<string, Map<string, number>> = new Map(); // Maps from_stop_id to {to_stop_id: time}
  private stopTimesMap: Map<string, Map<string, number>> = new Map(); // Maps "tripId-stopA-stopB" to travel time
  private directLines: DirectLine[] = [];
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // Process stop times data from Prisma
  async processStopTimes(): Promise<void> {
    console.log("Processing stop times...");
    
    // Fetch all stop times from the database
    const stopTimesData = await this.prisma.stopTime.findMany({
      include: {
        trip: true
      }
    });

    // Group stops by trip_id
    const stopsByTrip = new Map<string, Stop[]>();

    for (const stopTime of stopTimesData) {
      const tripId = stopTime.trip_id;
      if (!stopsByTrip.has(tripId)) {
        stopsByTrip.set(tripId, []);
      }
      stopsByTrip.get(tripId)!.push({
        trip_id: stopTime.trip_id,
        stop_id: stopTime.stop_id,
        arrival_time: stopTime.arrival_time,
        stop_sequence: stopTime.stop_sequence
      });
    }

    // Process each trip to build direct routes
    for (const [tripId, stops] of stopsByTrip.entries()) {
      // Sort stops by sequence
      const sortedStops = stops.sort((a, b) => a.stop_sequence - b.stop_sequence);

      // Build direct line
      const directLine: DirectLine = {
        trip_id: tripId,
        stops: sortedStops.map(s => s.stop_id),
        travelTimes: new Map()
      };

      // Add to stopsByLine map
      if (!this.stopsByLine.has(tripId)) {
        this.stopsByLine.set(tripId, new Set());
      }

      // Process each stop in the trip
      for (let i = 0; i < sortedStops.length; i++) {
        const currentStop = sortedStops[i];
        this.stopsByLine.get(tripId)!.add(currentStop.stop_id);

        // Initialize stop connections map
        if (!this.stopConnections.has(currentStop.stop_id)) {
          this.stopConnections.set(currentStop.stop_id, new Set());
        }

        // Connect to next stop if not the last one
        if (i < sortedStops.length - 1) {
          const nextStop = sortedStops[i + 1];
          this.stopConnections.get(currentStop.stop_id)!.add(nextStop.stop_id);

          // Calculate travel time
          const timeDiff = this.getTimeDifference(currentStop.arrival_time, nextStop.arrival_time);

          // Store travel time in direct line
          const key = `${currentStop.stop_id}-${nextStop.stop_id}`;
          directLine.travelTimes.set(key, timeDiff);

          // Store in lookup map
          if (!this.stopTimesMap.has(tripId)) {
            this.stopTimesMap.set(tripId, new Map());
          }
          this.stopTimesMap.get(tripId)!.set(`${currentStop.stop_id}-${nextStop.stop_id}`, timeDiff);
        }
      }

      this.directLines.push(directLine);
    }

    console.log(`Processed ${this.directLines.length} trips with ${this.stopConnections.size} stops`);
  }

  // Process transfers data from Prisma
  async processTransfers(): Promise<void> {
    console.log("Processing transfers...");
    
    // Fetch all transfers from the database
    const transfersData = await this.prisma.transfer.findMany();

    for (const transfer of transfersData) {
      const fromId = transfer.from_stop_id;
      const toId = transfer.to_stop_id;

      // Calculate transfer time
      const transferTime = transfer.min_transfer_time != null
        ? Math.round(transfer.min_transfer_time / 60)  // Convert seconds to minutes
        : 5;  // Default 5 minutes

      // Store transfer option
      if (!this.transferOptions.has(fromId)) {
        this.transferOptions.set(fromId, new Map());
      }
      this.transferOptions.get(fromId)!.set(toId, transferTime);

      // Add to stop connections
      if (!this.stopConnections.has(fromId)) {
        this.stopConnections.set(fromId, new Set());
      }
      this.stopConnections.get(fromId)!.add(toId);
    }

    // Handle station variants (like 101N, 101S)
    this.processVariantTransfers();

    console.log(`Processed ${transfersData.length} transfers`);
  }

  // Add transfers between station variants (N/S)
  private processVariantTransfers(): void {
    // Group stops by base station ID
    const stationVariants = new Map<string, Set<string>>();

    for (const stopId of this.stopConnections.keys()) {
      const baseStationId = this.getBaseStationId(stopId);
      if (!stationVariants.has(baseStationId)) {
        stationVariants.set(baseStationId, new Set());
      }
      stationVariants.get(baseStationId)!.add(stopId);
    }

    // Add transfers between variants of the same station
    for (const [baseId, variants] of stationVariants.entries()) {
      if (variants.size > 1) {
        const variantArray = Array.from(variants);

        for (let i = 0; i < variantArray.length; i++) {
          for (let j = 0; j < variantArray.length; j++) {
            if (i !== j) {
              const fromId = variantArray[i];
              const toId = variantArray[j];

              // Add transfer with 2 minute walking time
              if (!this.transferOptions.has(fromId)) {
                this.transferOptions.set(fromId, new Map());
              }
              this.transferOptions.get(fromId)!.set(toId, 2);

              // Add to stop connections
              if (!this.stopConnections.has(fromId)) {
                this.stopConnections.set(fromId, new Set());
              }
              this.stopConnections.get(fromId)!.add(toId);
            }
          }
        }
      }
    }
  }

  // Process stop data from Prisma
  async processStops(): Promise<StopData[]> {
    console.log("Processing stops...");
    
    // Fetch all stops from the database
    const stopsData = await this.prisma.stop.findMany();

    // Build station names map
    for (const stop of stopsData) {
      this.stationNames.set(stop.id, stop.name);
    }

    console.log(`Processed ${stopsData.length} stops`);
    return stopsData;
  }

  // Find paths between origin and destination
  findPaths(originStopIds: string[], destStopIds: string[], maxPaths: number = 5): PathResult[] {
    console.log(`Finding paths between ${originStopIds.length} origins and ${destStopIds.length} destinations...`);

    const results: PathResult[] = [];

    // Try each origin-destination pair
    for (const originId of originStopIds) {
      for (const destId of destStopIds) {
        // Skip if same stop
        if (originId === destId) continue;

        const result = this.findShortestPath(originId, destId);
        if (result) {
          results.push(result);
        }

        // Break early if we have enough paths
        if (results.length >= maxPaths) break;
      }

      // Break early if we have enough paths
      if (results.length >= maxPaths) break;
    }

    // Sort by travel time
    results.sort((a, b) => a.totalTime - b.totalTime);

    // Return top N results
    return results.slice(0, maxPaths);
  }

  // Find shortest path between two stops using a modified BFS approach
  private findShortestPath(start: string, end: string): PathResult | null {
    console.log(`Finding path from ${start} to ${end}`);

    // Check if stops exist
    if (!this.stopConnections.has(start)) {
      console.log(`Start stop ${start} not found in connections`);
      return null;
    }

    // Track visited stops and paths
    const queue: {
      stop: string;
      path: string[];
      time: number;
      transfers: number;
      transferPoints: string[];
      lastTrip: string | null;
    }[] = [];

    const visited = new Set<string>();

    // Start the search
    queue.push({
      stop: start,
      path: [start],
      time: 0,
      transfers: 0,
      transferPoints: [],
      lastTrip: null
    });

    // Track best path found so far
    let bestPath: PathResult | null = null;

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Skip if we've already found a better path
      if (bestPath && current.time > bestPath.totalTime * 1.5) {
        continue;
      }

      // If we reached the destination
      if (current.stop === end) {
        // Found a path
        bestPath = {
          path: current.path,
          totalTime: current.time,
          transfers: current.transfers,
          transferPoints: current.transferPoints
        };
        continue;
      }

      // Skip if already visited with a better path
      if (visited.has(current.stop)) {
        continue;
      }

      visited.add(current.stop);

      // Get direct connections
      const connections = this.stopConnections.get(current.stop) || new Set();

      // Process each connection
      for (const nextStop of connections) {
        // Skip if already in path to avoid loops
        if (current.path.includes(nextStop)) {
          continue;
        }

        // Check if this is a transfer
        let isTransfer = false;
        let transferTime = 0;
        let tripId: string | null = null;

        // Check if it's a direct connection on a line
        for (const line of this.directLines) {
          const stopIndex = line.stops.indexOf(current.stop);
          const nextStopIndex = line.stops.indexOf(nextStop);

          // Check if stops are adjacent on this line
          if (stopIndex !== -1 && nextStopIndex !== -1 && Math.abs(stopIndex - nextStopIndex) === 1) {
            tripId = line.trip_id;

            // Calculate travel time
            const timeKey = `${current.stop}-${nextStop}`;
            const reverseTimeKey = `${nextStop}-${current.stop}`;

            if (line.travelTimes.has(timeKey)) {
              transferTime = line.travelTimes.get(timeKey)!;
            } else if (line.travelTimes.has(reverseTimeKey)) {
              transferTime = line.travelTimes.get(reverseTimeKey)!;
            } else {
              // Default to 3 minutes if not found
              transferTime = 3;
            }

            break;
          }
        }

        // If not found in direct lines, check if it's a transfer
        if (!tripId) {
          const transfers = this.transferOptions.get(current.stop);
          if (transfers && transfers.has(nextStop)) {
            isTransfer = true;
            transferTime = transfers.get(nextStop)!;
            // Check if we're changing trips
            if (current.lastTrip) {
              // This is a transfer point
              queue.push({
                stop: nextStop,
                path: [...current.path, nextStop],
                time: current.time + transferTime,
                transfers: current.transfers + 1,
                transferPoints: [...current.transferPoints, current.stop],
                lastTrip: null // Reset trip ID after transfer
              });
              continue;
            }
          } else {
            // Skip if not connected
            continue;
          }
        }

        // Add to queue
        queue.push({
          stop: nextStop,
          path: [...current.path, nextStop],
          time: current.time + transferTime,
          transfers: current.transfers + (isTransfer && current.lastTrip !== tripId && current.lastTrip !== null ? 1 : 0),
          transferPoints: [...current.transferPoints, ...(isTransfer && current.lastTrip !== tripId && current.lastTrip !== null ? [current.stop] : [])],
          lastTrip: tripId || current.lastTrip
        });
      }
    }

    return bestPath;
  }

  // Get station name for a stop ID
  getStationName(stopId: string): string {
    return this.stationNames.get(stopId) || stopId;
  }

  // Extract base station ID (remove direction suffixes N, S)
  private getBaseStationId(stationId: string): string {
    return stationId.replace(/[NS]$/, '');
  }

  // Calculate time difference in minutes between two time strings
  private getTimeDifference(time1: string, time2: string): number {
    const parseTime = (time: string): number => {
      const [h, m, s = '0'] = time.split(':').map(Number);
      return h * 3600 + m * 60 + Number(s);
    };

    const seconds1 = parseTime(time1);
    const seconds2 = parseTime(time2);
    let timeDiff = seconds2 - seconds1;

    if (timeDiff < 0) {
      timeDiff += 24 * 3600; // Add 24 hours in seconds
    }

    return Math.round(timeDiff / 60); // Convert to minutes
  }

  // Find all stop IDs for a station name using Prisma
  static async findStationStopIds(
    prisma: PrismaClient,
    originName: string, 
    destinationName: string
  ): Promise<{ 
    originStopIds: string[], 
    destinationStopIds: string[],
    stopData: StopData[]
  }> {
    // Get all stops from database
    const stops = await prisma.stop.findMany();
    
    // Create maps to track parent stations and their stop IDs
    const stationMap = new Map<string, Set<string>>();
    const stationNameToIds = new Map<string, Set<string>>();

    // Process all stops to build relationship maps
    for (const stop of stops) {
      // Normalize station names for comparison
      const normalizedName = this.normalizeStationName(stop.name);

      // Add stop to the name-based lookup
      if (!stationNameToIds.has(normalizedName)) {
        stationNameToIds.set(normalizedName, new Set());
      }
      stationNameToIds.get(normalizedName)!.add(stop.id);

      // Track parent-child relationships
      if (stop.parent_stop_id) {
        if (!stationMap.has(stop.parent_stop_id)) {
          stationMap.set(stop.parent_stop_id, new Set());
        }
        stationMap.get(stop.parent_stop_id)!.add(stop.id);
      }
    }

    // Normalize input station names
    const normalizedOrigin = this.normalizeStationName(originName);
    const normalizedDestination = this.normalizeStationName(destinationName);

    // Find all stop IDs for origin and destination
    const originStopIds = this.findAllRelatedStopIds(normalizedOrigin, stationNameToIds, stationMap);
    const destinationStopIds = this.findAllRelatedStopIds(normalizedDestination, stationNameToIds, stationMap);

    return {
      originStopIds,
      destinationStopIds,
      stopData: stops
    };
  }

  // Normalizes station names for consistent comparison
  static normalizeStationName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Finds all stop IDs related to a station name, including parent/child relationships
  static findAllRelatedStopIds(
    stationName: string,
    stationNameToIds: Map<string, Set<string>>,
    stationMap: Map<string, Set<string>>
  ): string[] {
    const result = new Set<string>();

    // First find direct matches by name
    if (stationNameToIds.has(stationName)) {
      const directMatches = stationNameToIds.get(stationName)!;

      // Add all direct matches
      for (const stopId of directMatches) {
        result.add(stopId);

        // If this is a parent station, add all of its children
        if (stationMap.has(stopId)) {
          for (const childId of stationMap.get(stopId)!) {
            result.add(childId);
          }
        }
      }

      // Also do a fuzzy search for similar station names
      for (const [name, ids] of stationNameToIds.entries()) {
        if (name !== stationName && name.includes(stationName)) {
          for (const id of ids) {
            result.add(id);
          }
        }
      }
    } else {
      // If no exact match, try partial matching
      for (const [name, ids] of stationNameToIds.entries()) {
        if (name.includes(stationName) || stationName.includes(name)) {
          for (const id of ids) {
            result.add(id);

            // If this is a parent station, add all of its children
            if (stationMap.has(id)) {
              for (const childId of stationMap.get(id)!) {
                result.add(childId);
              }
            }
          }
        }
      }
    }

    return Array.from(result);
  }
}

// Main function to find transit routes
async function findRoutes(originStation: string, destinationStation: string, maxPaths: number = 5) {
  try {
    console.log(`Finding routes from "${originStation}" to "${destinationStation}"`);
    
    // Initialize Prisma client
    const prisma = new PrismaClient();
    
    try {
      // Step 1: Find stop IDs for station names
      const stationInfo = await TransitRouteFinder.findStationStopIds(
        prisma,
        originStation,
        destinationStation
      );

      console.log("Origin stop IDs:", stationInfo.originStopIds);
      console.log("Destination stop IDs:", stationInfo.destinationStopIds);

      // Step 2: Create and initialize the route finder
      const routeFinder = new TransitRouteFinder(prisma);

      // Step 3: Process all the data
      await routeFinder.processStops();
      await routeFinder.processStopTimes();
      await routeFinder.processTransfers();

      // Step 4: Find paths
      const routes = routeFinder.findPaths(
        stationInfo.originStopIds,
        stationInfo.destinationStopIds,
        maxPaths
      );

      // Step 5: Display results
      if (routes.length > 0) {
        console.log(`\nFound ${routes.length} routes from ${originStation} to ${destinationStation}:`);

        for (let i = 0; i < routes.length; i++) {
          const route = routes[i];
          console.log(`\n==== ROUTE ${i + 1} ====`);
          console.log(`Stops (${route.path.length}): ${route.path.join(' → ')}`);
          console.log(`Total Travel Time: ${route.totalTime} minutes`);
          console.log(`Number of Transfers: ${route.transfers}`);

          // Show transfer points with station names when available
          if (route.transferPoints.length > 0) {
            console.log("Transfer Points:");
            for (const transferPoint of route.transferPoints) {
              const stationName = routeFinder.getStationName(transferPoint);
              console.log(`  ${transferPoint} (${stationName})`);
            }
          } else {
            console.log("Transfer Points: None (direct route)");
          }
        }

        return routes;
      } else {
        console.log(`\nNo routes found between ${originStation} and ${destinationStation}`);
        return [];
      }
    } finally {
      // Always disconnect from Prisma when done
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error("Failed to find routes:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }
    throw error;
  }
}

// Main entry point
async function main() {
  try {
    // Get command line arguments or use defaults
    const args = process.argv.slice(2);
    const originStation = args[0] || "68 St-Hunter College";
    const destinationStation = args[1] || "Cathedral Pkwy (110 St)";
    const maxPaths = parseInt(args[2] || "3");

    await findRoutes(originStation, destinationStation, maxPaths);
  } catch (error) {
    console.error("Application failed:", error);
  }
}

// Only run main if this file is being run directly
if (require.main === module) {
  main();
}

export { TransitRouteFinder, findRoutes };