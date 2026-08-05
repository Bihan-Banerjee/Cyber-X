import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import scanRoutes from './routes/scan.js';
import honeypotRoutes from './routes/honeypot.js';
import axios from 'axios';
import signalRoutes from "./routes/signal.js";
import mapData from "./routes/mapData.js";

const app = express();
const PORT = process.env.PORT || 5000
// Python Flask RL API (src/server/rl/api.py) — serves on 5001 by default
const RL_API_URL = process.env.RL_API_URL || 'http://localhost:5001';

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many scan requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // The 20/15min budget exists to throttle scans that do real network work.
  // /recent-tools just reads an in-memory activity log, and the Command Center
  // polls it — counting those polls burned the whole budget in ~100s and left
  // the dashboard 429ing for the rest of the window.
  skip: (req) => req.path === '/recent-tools',
});

app.use('/api/scan', limiter, scanRoutes);
app.use("/api/map", mapData);
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/honeypot', honeypotRoutes);

// Proxy all /api/rl/* requests to Python Flask server.
// req.originalUrl keeps the /api/rl prefix (req.url has it stripped by the
// mount), and Flask registers its routes under /api/rl/... too.
// Streams the upstream response so Server-Sent Events endpoints
// (/api/rl/telemetry/stream, /api/rl/demo/stream, /api/rl/logs/stream) flow
// through in real time instead of being buffered into a single JSON reply.
// SSE endpoints must never time out; everything else should, so a hung Flask
// can't pin Express sockets open indefinitely.
const RL_STREAM_PATHS = ['/telemetry/stream', '/demo/stream', '/logs/stream'];
const RL_REQUEST_TIMEOUT_MS = 15_000;

app.use('/api/rl', async (req, res) => {
  const isStream = RL_STREAM_PATHS.some((p) => req.path.startsWith(p));
  try {
    const upstream = await axios({
      method: req.method,
      url: `${RL_API_URL}${req.originalUrl}`,
      data: req.body,
      headers: { 'Content-Type': req.headers['content-type'] || 'application/json' },
      responseType: 'stream',
      validateStatus: () => true,   // forward non-2xx instead of throwing
      timeout: isStream ? 0 : RL_REQUEST_TIMEOUT_MS,
    });

    res.status(upstream.status);
    const contentType = upstream.headers['content-type'];
    if (contentType) res.setHeader('Content-Type', contentType);

    if (contentType && contentType.includes('text/event-stream')) {
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      (res as any).flushHeaders?.();
    }

    upstream.data.pipe(res);
    req.on('close', () => upstream.data.destroy());
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: error.message
    });
  }
});
app.use("/api/signal", signalRoutes);

app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});