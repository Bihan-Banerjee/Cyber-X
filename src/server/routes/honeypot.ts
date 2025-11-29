import express from 'express';
import honeypotManager from '../honeypot/honeypotManager.js';
import { logToolActivity } from '../utils/activityLogger.js';

const router = express.Router();

// Get Honeypot Status
router.get('/status', async (req, res) => {
  try {
    const statuses = await honeypotManager.getHoneypotsStatus();
    res.json({ honeypots: statuses });
  } catch (error: any) {
    console.error('Honeypot status error:', error);
    res.status(500).json({
      error: 'Failed to get honeypot status',
      message: error.message,
    });
  }
});

// Get Recent Attacks
router.get('/attacks/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const attacks = await honeypotManager.getRecentAttacks(limit);
    
    logToolActivity('Honeypot Monitor', `Retrieved ${attacks.length} recent attacks`, 'info');
    
    res.json({ attacks });
  } catch (error: any) {
    console.error('Recent attacks error:', error);
    res.status(500).json({
      error: 'Failed to get recent attacks',
      message: error.message,
    });
  }
});

// Get Attack Statistics
router.get('/attacks/stats', async (req, res) => {
  try {
    const stats = await honeypotManager.getAttackStats();
    
    logToolActivity('Honeypot Analytics', `Retrieved attack statistics`, 'success');
    
    res.json(stats);
  } catch (error: any) {
    console.error('Attack stats error:', error);
    res.status(500).json({
      error: 'Failed to get attack statistics',
      message: error.message,
    });
  }
});

// Start Honeypot
router.post('/start/:type', async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!['cowrie', 'dionaea', 'zeek'].includes(type)) {
      return res.status(400).json({ error: 'Invalid honeypot type' });
    }
    
    logToolActivity('Honeypot Control', `Starting ${type} honeypot`, 'info');
    
    const result = await honeypotManager.startHoneypot(type);
    
    if (result.success) {
      logToolActivity('Honeypot Control', `${type} started successfully`, 'success');
    } else {
      logToolActivity('Honeypot Control', `Failed to start ${type}`, 'warning');
    }
    
    res.json(result);
  } catch (error: any) {
    console.error('Start honeypot error:', error);
    res.status(500).json({
      error: 'Failed to start honeypot',
      message: error.message,
    });
  }
});

// Stop Honeypot
router.post('/stop/:type', async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!['cowrie', 'dionaea', 'zeek'].includes(type)) {
      return res.status(400).json({ error: 'Invalid honeypot type' });
    }
    
    logToolActivity('Honeypot Control', `Stopping ${type} honeypot`, 'info');
    
    const result = await honeypotManager.stopHoneypot(type);
    
    if (result.success) {
      logToolActivity('Honeypot Control', `${type} stopped successfully`, 'success');
    } else {
      logToolActivity('Honeypot Control', `Failed to stop ${type}`, 'warning');
    }
    
    res.json(result);
  } catch (error: any) {
    console.error('Stop honeypot error:', error);
    res.status(500).json({
      error: 'Failed to stop honeypot',
      message: error.message,
    });
  }
});

export default router;
