import express from "express";

const router = express.Router();

interface CacheEntry {
  body: Buffer;
  contentType?: string | null;
  fetchedAt: number;
}

class ExternalCache {
  private cache = new Map<string, CacheEntry>();

  async get(url: string): Promise<CacheEntry> {
    const existing = this.cache.get(url);
    if (existing && Date.now() - existing.fetchedAt < 60000) return existing;
    return this.fetchAndStore(url);
  }

  private async fetchAndStore(url: string): Promise<CacheEntry> {
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    const entry: CacheEntry = {
      body: buf,
      contentType: res.headers.get("content-type"),
      fetchedAt: Date.now(),
    };
    this.cache.set(url, entry);
    return entry;
  }
}

const externalCache = new ExternalCache();

type Station = {
  id: string;
  name: string;
  status: "OK" | "WARN" | "DELAY";
  message: string;
  lines: {
    id: string;
    color: string;
    name: string;
  }[];
};

// --- Helpers to parse incidents and map to stations ---

type StationId =
  | "newark-penn"
  | "harrison"
  | "journal-square"
  | "grove-street"
  | "exchange-place"
  | "pavonia-newport"
  | "hoboken-terminal"
  | "christopher-street"
  | "world-trade-center"
  | "33rd-street"
  | "23rd-street"
  | "14th-street"
  | "9th-street";

const STATION_ALIASES: Record<StationId, (string | RegExp)[]> = {
  "newark-penn": [
    "Newark Penn",
    "Newark Penn Station",
    /\bNWK\b/i,
    /\bNewark\b/i,
  ],
  harrison: [/\bHarrison\b/i],
  "journal-square": [/\bJSQ\b/i, /Journal Square/i],
  "grove-street": [/Grove Street/i, /\bGrove St\b/i, /\bGrove\b/i],
  "exchange-place": [/Exchange Place/i, /\bExchange Pl\b/i],
  "pavonia-newport": [/Pavonia-Newport/i, /\bNewport\b/i, /\bPavonia\b/i],
  "hoboken-terminal": [/\bHoboken\b/i, /Hoboken Terminal/i],
  "christopher-street": [/Christopher Street/i, /\bChristopher St\b/i],
  "world-trade-center": [/World Trade Center/i, /\bWTC\b/i, /World Trade Ctr/i],
  "33rd-street": [/\b33(?:rd)?(?:\s|-)St(?:reet)?\b/i, /33rd Street/i],
  "23rd-street": [/\b23(?:rd)?(?:\s|-)St(?:reet)?\b/i, /23rd Street/i],
  "14th-street": [/\b14(?:th)?(?:\s|-)St(?:reet)?\b/i, /14th Street/i],
  "9th-street": [/\b9(?:th)?(?:\s|-)St(?:reet)?\b/i, /9th Street/i, /\b9th\b/i],
};

// --- Line metadata and station line assignments ---

type LineId = "NWK-WTC" | "HOB-33" | "HOB-WTC" | "JSQ-33";

const LINE_COLORS: Record<LineId, string> = {
  // Converted from rgb() to hex
  "NWK-WTC": "#D93A30", // rgb(217, 58, 48)
  "HOB-33": "#2B85BB", // rgb(43, 133, 187)  (HOB-33rd)
  "HOB-WTC": "#65C100", // rgb(101, 193, 0)  (HOB_WTC)
  "JSQ-33": "#FF9900", // rgb(255, 153, 0)  (JSQ-33rd)
};

const STATION_LINE_MAP: Record<StationId, LineId[]> = {
  "newark-penn": ["NWK-WTC"],
  harrison: ["NWK-WTC"], // inferred
  "journal-square": ["NWK-WTC", "JSQ-33"],
  "grove-street": ["NWK-WTC", "JSQ-33"],
  "exchange-place": ["HOB-WTC", "NWK-WTC"],
  "pavonia-newport": ["HOB-WTC", "JSQ-33"],
  "hoboken-terminal": ["HOB-33", "HOB-WTC"],
  "christopher-street": ["HOB-33", "JSQ-33"],
  "world-trade-center": ["HOB-WTC", "NWK-WTC"],
  "33rd-street": ["HOB-33", "JSQ-33"],
  "23rd-street": ["HOB-33", "JSQ-33"],
  "14th-street": ["HOB-33", "JSQ-33"],
  "9th-street": ["HOB-33", "JSQ-33"],
};

function buildLines(
  lineIds: LineId[]
): { id: string; color: string; name: string }[] {
  return lineIds.map((id) => ({ id, color: LINE_COLORS[id], name: id }));
}

function severityFromText(text: string): Station["status"] {
  const t = text.toLowerCase();
  if (
    /\b(delay|delays|delayed|suspend|suspension|no service|holding|significant)\b/i.test(
      t
    )
  ) {
    return "DELAY";
  }
  if (
    /\b(elevator|escalator|out of service|maintenance|cleaning|disabled)\b/i.test(
      t
    )
  ) {
    return "WARN";
  }
  // Default to WARN if it's an alert but not clearly a delay
  return "WARN";
}

function maxSeverity(
  a: Station["status"],
  b: Station["status"]
): Station["status"] {
  const order: Station["status"][] = ["OK", "WARN", "DELAY"];
  return order.indexOf(b) > order.indexOf(a) ? b : a;
}

function matchStationIds(text: string): StationId[] {
  const hits: StationId[] = [];
  for (const [id, aliases] of Object.entries(STATION_ALIASES) as [
    StationId,
    (string | RegExp)[]
  ][]) {
    if (
      aliases.some((alias) =>
        typeof alias === "string"
          ? new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i").test(text)
          : alias.test(text)
      )
    ) {
      hits.push(id);
    }
  }
  return hits;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get("/", async (req, res) => {
  try {
    const entry = await externalCache.get(
      "https://www.panynj.gov/bin/portauthority/everbridge/incidents?status=All&department=Path"
    );
    if (entry.contentType) res.setHeader("Content-Type", entry.contentType);

    let stations: Station[] = [
      {
        id: "newark-penn",
        name: "Newark Penn Station",
        status: "OK",
        message: "Regular service",
        lines: buildLines(STATION_LINE_MAP["newark-penn"]),
      },
      {
        id: "harrison",
        name: "Harrison",
        status: "OK",
        message: "Regular service",
        lines: buildLines(STATION_LINE_MAP["harrison"] ?? []),
      },
      {
        id: "journal-square",
        name: "Journal Square",
        status: "OK",
        message: "Regular service",
        lines: buildLines(STATION_LINE_MAP["journal-square"]),
      },
      {
        id: "grove-street",
        name: "Grove Street",
        status: "OK",
        message: "Regular service",
        lines: buildLines(STATION_LINE_MAP["grove-street"]),
      },
      {
        id: "exchange-place",
        name: "Exchange Place",
        status: "OK",
        message: "Regular service",
        lines: buildLines(STATION_LINE_MAP["exchange-place"]),
      },
      {
        id: "pavonia-newport",
        name: "Newport",
        status: "OK",
        message: "Regular service",
        lines: buildLines(STATION_LINE_MAP["pavonia-newport"]),
      },
      {
        id: "hoboken-terminal",
        name: "Hoboken Terminal",
        status: "OK",
        message: "Regular service",
        lines: buildLines(STATION_LINE_MAP["hoboken-terminal"]),
      },
      {
        id: "christopher-street",
        name: "Christopher Street",
        status: "OK",
        message: "Regular service",
        lines: buildLines(STATION_LINE_MAP["christopher-street"]),
      },
      {
        id: "world-trade-center",
        name: "World Trade Center",
        status: "OK",
        message: "Regular service",
        lines: buildLines(STATION_LINE_MAP["world-trade-center"]),
      },
      {
        id: "33rd-street",
        name: "33rd Street",
        status: "OK",
        message: "Regular service",
        lines: buildLines(STATION_LINE_MAP["33rd-street"]),
      },
      {
        id: "23rd-street",
        name: "23rd Street",
        status: "OK",
        message: "Regular service",
        lines: buildLines(STATION_LINE_MAP["23rd-street"]),
      },
      {
        id: "14th-street",
        name: "14th Street",
        status: "OK",
        message: "Regular service",
        lines: buildLines(STATION_LINE_MAP["14th-street"]),
      },
      {
        id: "9th-street",
        name: "9th Street",
        status: "OK",
        message: "Regular service",
        lines: buildLines(STATION_LINE_MAP["9th-street"]),
      },
    ];

    // Parse remote JSON body safely
    let incidents: any[] = [];
    try {
      const text = entry.body.toString("utf8");
      const json = JSON.parse(text);
      if (json && Array.isArray(json.data)) incidents = json.data;
    } catch {
      // Ignore parse errors; keep defaults
    }

    // Update stations based on incidents
    for (const item of incidents) {
      const msg = item?.incidentMessage;
      if (!msg) continue;

      // Prefer the detailed preMessage; fall back to subject
      const fullText = [msg.preMessage, msg.subject]
        .filter(Boolean)
        .join(" - ")
        .trim();
      if (!fullText) continue;

      const severity = severityFromText(fullText);
      const matched = matchStationIds(fullText);

      // If message seems system-wide and no station matched, optionally apply to all
      const systemWide =
        matched.length === 0 &&
        /\b(system(?:-|\s)?wide|all stations|entire (?:path|line))\b/i.test(
          fullText
        );

      const applyIds =
        matched.length > 0
          ? matched
          : systemWide
          ? (stations.map((s) => s.id) as StationId[])
          : [];

      for (const id of applyIds) {
        const s = stations.find((x) => x.id === id);
        if (!s) continue;

        // Upgrade severity if needed
        s.status = maxSeverity(s.status, severity);

        // Append/replace message
        if (s.message === "Regular service") {
          s.message = fullText;
        } else if (!s.message.includes(fullText)) {
          s.message = `${s.message} | ${fullText}`;
        }
      }
    }

    res.json(stations);
  } catch (err) {
    res.status(502).json({ error: "Failed to fetch remote URL" });
  }
});

export default router;
