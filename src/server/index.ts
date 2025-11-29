import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import scanRoutes from './routes/scan';
import honeypotRoutes from './routes/honeypot.js';

const app = express();
const PORT = process.env.PORT || 3001;

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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🔒 Security scanner API running on port ${PORT}`);
});

app.use('/api/honeypot', honeypotRoutes);