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
app.use('/api/rl', async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${RL_API_URL}${req.originalUrl}`,
      data: req.body,
      headers: { 'Content-Type': req.headers['content-type'] || 'application/json' },
    });
    res.status(response.status).json(response.data);
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