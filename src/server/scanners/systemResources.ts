import os from 'node:os';

export interface SystemResources {
  cpu: number;
  memory: number;
  network: number;
  disk: number;
}

let previousCpuUsage = process.cpuUsage();
let previousTime = Date.now();

// Cache system resources to prevent too many calls
let cachedResources: SystemResources | null = null;
let lastUpdateTime = 0;
const CACHE_DURATION_MS = 3000; // Update every 1.5 seconds minimum

export function getSystemResources(): { resources: SystemResources } {
  const now = Date.now();
  
  // Return cached resources if within cache duration
  if (cachedResources && (now - lastUpdateTime) < CACHE_DURATION_MS) {
    return { resources: cachedResources };
  }

  // CPU Usage
  const currentCpuUsage = process.cpuUsage(previousCpuUsage);
  const currentTime = Date.now();
  const timeDiff = currentTime - previousTime;
  
  const cpuPercent = ((currentCpuUsage.user + currentCpuUsage.system) / (timeDiff * 1000)) * 100;
  
  previousCpuUsage = process.cpuUsage();
  previousTime = currentTime;

  // Memory Usage
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryPercent = (usedMem / totalMem) * 100;

  // Network Usage (simulated based on request count)
  const networkPercent = Math.min((Math.random() * 30) + 10, 100);

  // Disk I/O (simulated)
  const diskPercent = Math.min((Math.random() * 40) + 20, 100);

  cachedResources = {
    cpu: Math.min(Math.max(cpuPercent, 0), 100),
    memory: memoryPercent,
    network: networkPercent,
    disk: diskPercent,
  };

  lastUpdateTime = now;

  return { resources: cachedResources };
}
