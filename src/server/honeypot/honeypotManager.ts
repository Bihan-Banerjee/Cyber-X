import Docker from 'dockerode';
import axios from 'axios';

// Initialize Docker API (Connects to the local Docker daemon socket)
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export interface HoneypotStatus {
  name: string;
  type: 'cowrie' | 'dionaea' | 'zeek';
  status: 'running' | 'stopped' | 'error';
  uptime: number;
  connections: number;
  attacks: number;
  ports: number[];
}

export interface AttackEvent {
  timestamp: string;
  source_ip: string;
  destination_port: number;
  protocol: string;
  honeypot: string;
  event_type: string;
  details: any;
  geoip?: {
    country: string;
    city: string;
    latitude: number;
    longitude: number;
  };
}

class HoneypotManager {
  private elasticsearchUrl = 'http://localhost:9200';
  
  /**
   * Get status of all honeypots using the official Docker API
   */
  async getHoneypotsStatus(): Promise<HoneypotStatus[]> {
    try {
      // Fetch all containers that have 'cyberx' in their name
      const containers = await docker.listContainers({ all: true });
      const cyberxContainers = containers.filter(c => 
        c.Names.some(name => name.includes('cyberx'))
      );
      
      const statuses: HoneypotStatus[] = [];
      
      for (const containerInfo of cyberxContainers) {
        const name = containerInfo.Names[0];
        const isRunning = containerInfo.State === 'running';
        
        // Calculate uptime accurately from Unix timestamps
        const uptimeSeconds = isRunning 
            ? Math.floor((Date.now() - (containerInfo.Created * 1000)) / 1000) 
            : 0;

        if (name.includes('cowrie')) {
          statuses.push({
            name: 'Cowrie SSH Honeypot',
            type: 'cowrie',
            status: isRunning ? 'running' : 'stopped',
            uptime: uptimeSeconds,
            connections: await this.getConnectionCount('cowrie'),
            attacks: await this.getAttackCount('cowrie'),
            ports: [2222, 2223],
          });
        } else if (name.includes('dionaea')) {
          statuses.push({
            name: 'Dionaea Multi-Protocol',
            type: 'dionaea',
            status: isRunning ? 'running' : 'stopped',
            uptime: uptimeSeconds,
            connections: await this.getConnectionCount('dionaea'),
            attacks: await this.getAttackCount('dionaea'),
            ports: [21, 42, 135, 445, 1433, 3306, 5060],
          });
        } else if (name.includes('zeek')) {
          statuses.push({
            name: 'Zeek Network Monitor',
            type: 'zeek',
            status: isRunning ? 'running' : 'stopped',
            uptime: uptimeSeconds,
            connections: await this.getConnectionCount('zeek'),
            attacks: 0,
            ports: [],
          });
        }
      }
      
      return statuses;
    } catch (error) {
      console.error('Failed to get honeypot status from Docker API:', error);
      return [];
    }
  }
  
  /**
   * Start a honeypot securely via Docker API
   */
  async startHoneypot(type: string): Promise<{ success: boolean; message: string }> {
    try {
      const containerName = `cyberx-${type}`;
      const container = docker.getContainer(containerName);
      
      await container.start();
      return {
        success: true,
        message: `${type} honeypot started successfully`,
      };
    } catch (error: any) {
      // Handle case where container doesn't exist yet
      if (error.statusCode === 404) {
        return { success: false, message: `Container cyberx-${type} not found. Run docker-compose first.` };
      }
      return {
        success: false,
        message: `Failed to start ${type}: ${error.message}`,
      };
    }
  }
  
  /**
   * Stop a honeypot securely via Docker API
   */
  async stopHoneypot(type: string): Promise<{ success: boolean; message: string }> {
    try {
      const containerName = `cyberx-${type}`;
      const container = docker.getContainer(containerName);
      
      await container.stop();
      return {
        success: true,
        message: `${type} honeypot stopped successfully`,
      };
    } catch (error: any) {
      if (error.statusCode === 304) {
         return { success: true, message: `${type} is already stopped.` };
      }
      return {
        success: false,
        message: `Failed to stop ${type}: ${error.message}`,
      };
    }
  }

  // --- Elasticsearch Methods (Unchanged) ---
  
  async getRecentAttacks(limit: number = 50): Promise<AttackEvent[]> {
    try {
      const response = await axios.post(`${this.elasticsearchUrl}/honeypot-*/_search`, {
          size: limit, sort: [{ '@timestamp': { order: 'desc' } }],
          query: { bool: { must: [{ range: { '@timestamp': { gte: 'now-24h' } } }] } }
      });
      return response.data.hits.hits.map((hit: any) => ({
        timestamp: hit._source['@timestamp'],
        source_ip: hit._source.src_ip || hit._source.remote_host || hit._source.id_orig_h,
        destination_port: hit._source.dst_port || hit._source.id_resp_p,
        protocol: hit._source.protocol || hit._source.proto || 'unknown',
        honeypot: hit._source.honeypot_type,
        event_type: hit._source.eventid || hit._source.connection_type || 'connection',
        details: hit._source,
        geoip: hit._source.geoip,
      }));
    } catch (error) {
      console.error('Failed to fetch attacks:', error);
      return [];
    }
  }
  
  async getAttackStats(): Promise<any> {
    try {
      const response = await axios.post(`${this.elasticsearchUrl}/honeypot-*/_search`, {
          size: 0, query: { range: { '@timestamp': { gte: 'now-7d' } } },
          aggs: {
            attacks_over_time: { date_histogram: { field: '@timestamp', calendar_interval: 'hour' } },
            top_attackers: { terms: { field: 'src_ip.keyword', size: 10 } },
            top_protocols: { terms: { field: 'protocol.keyword', size: 10 } },
            countries: { terms: { field: 'geoip.country_name.keyword', size: 10 } }
          }
      });
      return {
        total: response.data.hits.total.value,
        timeline: response.data.aggregations.attacks_over_time.buckets,
        topAttackers: response.data.aggregations.top_attackers.buckets,
        topProtocols: response.data.aggregations.top_protocols.buckets,
        countries: response.data.aggregations.countries.buckets,
      };
    } catch (error) {
      return null;
    }
  }
  
  private async getConnectionCount(honeypotType: string): Promise<number> {
    try {
      const response = await axios.post(`${this.elasticsearchUrl}/honeypot-${honeypotType}-*/_count`, {
          query: { range: { '@timestamp': { gte: 'now-1h' } } }
      });
      return response.data.count;
    } catch (error) { return 0; }
  }
  
  private async getAttackCount(honeypotType: string): Promise<number> {
    try {
      const response = await axios.post(`${this.elasticsearchUrl}/honeypot-${honeypotType}-*/_count`, {
          query: { range: { '@timestamp': { gte: 'now-24h' } } }
      });
      return response.data.count;
    } catch (error) { return 0; }
  }
}

export default new HoneypotManager();