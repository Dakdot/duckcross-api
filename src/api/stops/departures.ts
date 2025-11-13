import express from "express";
import { PrismaClient } from "../../../generated/prisma";

const router = express.Router();
const db = new PrismaClient();

// Helper function to format time in local timezone
function formatTimeInTimezone(
  date: Date,
  timezone: string
): { formattedTime: string; dayOfWeek: number } {
  // Format time string HH:MM:SS in the agency's timezone
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // Get day of week (0 = Sunday, 1 = Monday, etc.) in the agency's timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    weekday: "long",
  };
  const weekday = new Intl.DateTimeFormat("en-US", options).format(date);

  const weekdayMap: { [key: string]: number } = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  return {
    formattedTime: timeFormatter.format(date).replace(/:/g, ":"),
    dayOfWeek: weekdayMap[weekday],
  };
}

router.get<{ stopId: string }>("/:stopId/departures", async (req, res) => {
  const stopId = req.params.stopId;
  const now = new Date();

  // Find the stop
  const stop = await db.stop.findFirst({
    where: {
      id: stopId,
    },
    include: {
      stop_times: {
        include: {
          trip: {
            include: {
              route: {
                include: {
                  agency: true,
                },
              },
            },
          },
        },
        take: 1, // Just to get an agency
      },
    },
  });

  if (!stop) {
    return res.status(404).json({ error: `Stop with ID ${stopId} not found` });
  }

  // Get the timezone from stop, agency, or default to UTC
  let timezone = "UTC";

  // Try to get timezone from stop first
  if (stop.timezone) {
    timezone = stop.timezone;
  }
  // If not available, try to get from an agency serving this stop
  else if (
    stop.stop_times.length > 0 &&
    stop.stop_times[0].trip?.route?.agency?.timezone
  ) {
    timezone = stop.stop_times[0].trip.route.agency.timezone;
  }

  // Format time and get day of week in the appropriate timezone
  const { formattedTime: currentTime, dayOfWeek } = formatTimeInTimezone(
    now,
    timezone
  );

  console.log(
    `Using timezone: ${timezone}, Current time: ${currentTime}, Day of week: ${dayOfWeek}`
  );

  const trips = await db.stopTime.groupBy({
    by: ["trip_id"],
    _max: {
      sequence: true,
    },
    where: {
      trip: {
        service: {
          start_date: {
            lte: now,
          },
          end_date: {
            gte: now,
          },
          OR: [
            {
              ...(dayOfWeek === 0 && { sunday: true }),
              ...(dayOfWeek === 1 && { monday: true }),
              ...(dayOfWeek === 2 && { tuesday: true }),
              ...(dayOfWeek === 3 && { wednesday: true }),
              ...(dayOfWeek === 4 && { thursday: true }),
              ...(dayOfWeek === 5 && { friday: true }),
              ...(dayOfWeek === 6 && { saturday: true }),
            },
            {
              exceptions: {
                some: {
                  date: now,
                },
              },
            },
          ],
        },
      },
    },
  });

  const tripMap = Object.fromEntries(
    trips.map((e) => [e.trip_id, e._max.sequence])
  );

  const data = await db.stopTime.findMany({
    where: {
      departure_time: {
        gte: currentTime,
      },
      OR: [
        {
          stop_id: stopId,
        },
        {
          stop: {
            parent_station_id: stopId,
          },
        },
      ],
      trip: {
        service: {
          start_date: {
            lte: now,
          },
          end_date: {
            gte: now,
          },
          OR: [
            {
              ...(dayOfWeek === 0 && { sunday: true }),
              ...(dayOfWeek === 1 && { monday: true }),
              ...(dayOfWeek === 2 && { tuesday: true }),
              ...(dayOfWeek === 3 && { wednesday: true }),
              ...(dayOfWeek === 4 && { thursday: true }),
              ...(dayOfWeek === 5 && { friday: true }),
              ...(dayOfWeek === 6 && { saturday: true }),
            },
            {
              exceptions: {
                some: {
                  date: now,
                },
              },
            },
          ],
        },
      },
    },
    orderBy: {
      departure_time: "asc",
    },
    include: {
      trip: {
        include: {
          route: true,
        },
      },
    },
    take: 20,
  });

  const filteredData = data.filter((e) => e.sequence !== tripMap[e.trip_id]);

  res.json({
    stop: {
      ...stop,
      timezone,
    },
    departures: [...filteredData],
  });
});

export default router;
