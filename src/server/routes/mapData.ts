import { Router } from "express";
import fetch from "node-fetch";

const router = Router();

/* -------------------------
   SIGNAL STRENGTH (Cloudflare Radar Snapshot)
-------------------------- */

interface CloudflareRadarResponse {
  result?: {
    top_ases?: {
      asnLocation: string;
      bandwidthDownload: string | number;
    }[];
  };
}

router.get("/signal", async (_req, res) => {
  try {
    const resp = await fetch(
      "https://api.cloudflare.com/client/v4/radar/quality/speed/summary"
    );

    const raw = await resp.json();
    const json = raw as CloudflareRadarResponse;

    // Convert to country → avg speed map
    const data = json.result?.top_ases ?? [];

    const out = data.map((d) => ({
      country: d.asnLocation,
      download: Number(d.bandwidthDownload),
    }));

    res.json(out);
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

/* -------------------------
   DOWNTIME (Cloudflare Status)
-------------------------- */

interface CloudflareStatusResponse {
  incidents: {
    name: string;
    status: string;
  }[];
}

router.get("/downtime", async (_req, res) => {
  try {
    const resp = await fetch(
      "https://www.cloudflarestatus.com/api/v2/incidents.json"
    );

    const raw = await resp.json();
    const json = raw as CloudflareStatusResponse;


    const incidents = json.incidents.map((i) => ({
      name: i.name,
      status: i.status,
      lat: 20 + Math.random() * 20,
      lng: -30 + Math.random() * 60,
    }));

    res.json(incidents);
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

export default router;
