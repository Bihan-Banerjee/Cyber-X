import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import scanRoutes from './routes/scan.js';
import honeypotRoutes from './routes/honeypot.js';
import axios from 'axios';
import signalRoutes from "./routes/signal.js";
import mapData from "./routes/mapData.js";
import { clientErrorMessage } from './utils/safeError.js';

const app = express();
const PORT = process.env.PORT || 5000
// Python Flask RL API (src/server/rl/api.py) — serves on 5001 by default
const RL_API_URL = process.env.RL_API_URL || 'http://localhost:5001';

// One proxy hop (Vite dev proxy / a reverse proxy) so express-rate-limit and
// req.ip resolve the real client instead of the proxy.
app.set('trust proxy', 1);

// CORS allowlist. Defaults to local dev origins. In production set CORS_ORIGINS
// to your frontend's public URL(s), comma-separated, e.g.
//   CORS_ORIGINS=https://cyberx.example.com,https://cyberx.onrender.com
// Or set CORS_ORIGINS=* to allow any origin (fine for a public demo — the API
// is unauthenticated by default anyway; add CYBERX_API_KEY to lock it down).
// This replaced the previous cors() that allowed ANY origin; the localhost-only
// default silently blocked hosted frontends, so it is now explicitly configurable.
const CORS_ORIGINS = (process.env.CORS_ORIGINS
  || 'http://localhost:8080,http://localhost:5173,http://localhost:3000')
  .split(',').map((o) => o.trim()).filter(Boolean);
const ALLOW_ALL_ORIGINS = CORS_ORIGINS.includes('*');
app.use(cors({
  origin(origin, cb) {
    // Requests with no Origin (curl, server-to-server, same-origin) are allowed.
    if (!origin || ALLOW_ALL_ORIGINS || CORS_ORIGINS.includes(origin)) return cb(null, true);
    // Not on the allowlist: don't set the CORS header (the browser blocks it),
    // but don't throw — a 500 here would be misleading.
    return cb(null, false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
}));

// Minimal security headers (helmet is not a dependency; these are the ones that
// matter for a JSON API + SPA without pulling a new package).
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});

app.use(express.json({ limit: '1mb' }));

// Optional API-key gate. If CYBERX_API_KEY is set, every /api/* request (except
// /health) must send a matching X-API-Key header. Unset (the default) = open,
// for local dev. This is the switch that makes the tool safe to expose at all —
// there was previously no auth anywhere.
const API_KEY = process.env.CYBERX_API_KEY;
function apiKeyGuard(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!API_KEY) return next();
  if (req.method === 'OPTIONS') return next();
  if (req.get('X-API-Key') === API_KEY) return next();
  return res.status(401).json({ error: 'Unauthorized: missing or invalid X-API-Key' });
}

const limiter = rateLimit({
  windowMs: Number(process.env.SCAN_RATE_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.SCAN_RATE_MAX) || 20,
  message: { error: 'Too many scan requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // The 20/15min budget exists to throttle scans that do real network work.
  // /recent-tools just reads an in-memory activity log, and the Command Center
  // polls it — counting those polls burned the whole budget in ~100s and left
  // the dashboard 429ing for the rest of the window.
  skip: (req) => req.path === '/recent-tools',
});

app.use('/api/scan', apiKeyGuard, limiter, scanRoutes);
app.use("/api/map", mapData);
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/honeypot', apiKeyGuard, honeypotRoutes);

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

app.use('/api/rl', apiKeyGuard, async (req, res) => {
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
      res.flushHeaders?.();
    }

    upstream.data.pipe(res);
    req.on('close', () => upstream.data.destroy());
  } catch (error: unknown) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    res.status(status || 500).json({
      error: clientErrorMessage(error, 'RL API request failed'),
    });
  }
});
app.use("/api/signal", signalRoutes);

app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
