import { Router } from "express";
import fetch from "node-fetch";
import { parse } from "csv-parse/sync";

const router = Router();

router.get("/countries", async (_req, res) => {
  try {
    const response = await fetch(
      "https://storage.googleapis.com/mlab-oti/ndt/ndt7-country-aggregates.csv"
    );

    const csvText = await response.text();

    // DEBUG: ensure we actually got CSV
    if (!csvText.includes("country")) {
      console.error("Unexpected CSV content (first 200 chars):");
      console.error(csvText.slice(0, 200));
      return res.status(500).json({ error: "Invalid CSV content" });
    }

    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
    });

    const results: any[] = [];

    for (const row of records) {
      // These columns EXIST in this dataset
      const country = row.client_country || row.country_code;
      const download = Number(
        row.mean_download_mbps ??
        row.mean_download_throughput_mbps
      );
      const upload = Number(
        row.mean_upload_mbps ??
        row.mean_upload_throughput_mbps
      );
      const latency = Number(row.mean_rtt_ms);

      if (!country || Number.isNaN(download)) continue;

      results.push({
        country,
        download,
        upload: Number.isNaN(upload) ? 0 : upload,
        latency: Number.isNaN(latency) ? 0 : latency,
      });
    }

    console.log(`✅ Parsed ${results.length} countries from M-Lab`);
    res.json(results);
  } catch (err) {
    console.error("M-Lab fetch error:", err);
    res.status(500).json({ error: "M-Lab fetch failed" });
  }
});

export default router;
