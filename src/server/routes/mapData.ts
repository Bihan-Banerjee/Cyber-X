import { Router } from "express";
import fetch from "node-fetch";

const router = Router();

/* -------------------------
   SIGNAL STRENGTH (Cloudflare Radar Snapshot)
-------------------------- */

router.get("/signal", async (_req, res) => {
  try {
    const resp = await fetch(
      "https://api.cloudflare.com/client/v4/radar/quality/speed/summary"
    );
    const json = await resp.json();

    // Convert to country → avg speed map
    const data = json.result?.top_ases || [];

    const out = data.map((d: any) => ({
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

router.get("/downtime", async (_req, res) => {
  try {
    const resp = await fetch(
      "https://www.cloudflarestatus.com/api/v2/incidents.json"
    );
    const json = await resp.json();

    const incidents = json.incidents.map((i: any) => ({
      name: i.name,
      status: i.status,
      lat: 20 + Math.random() * 20,
      lng: -30 + Math.random() * 60
    }));

    res.json(incidents);
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

export default router;
