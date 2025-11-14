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

router.get("/", async (req, res) => {
  try {
    const entry = await externalCache.get(
      "https://www.panynj.gov/bin/portauthority/everbridge/incidents?status=All&department=Path"
    );
    if (entry.contentType) res.setHeader("Content-Type", entry.contentType);
    res.send(entry.body);
  } catch (err) {
    res.status(502).json({ error: "Failed to fetch remote URL" });
  }
});

export default router;
