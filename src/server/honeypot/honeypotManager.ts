import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

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
   * Get status of all honeypots
   */
  async getHoneypotsStatus(): Promise<HoneypotStatus[]> {
    try {
      const { stdout } = await execAsync('docker ps --format "{{.Names}}\t{{.Status}}"');
      const containers = stdout.trim().split('\n');
      
      const statuses: HoneypotStatus[] = [];
      
      for (const container of containers) {
        const [name, status] = container.split('\t');
        
        if (name.includes('cowrie')) {
          statuses.push({
            name: 'Cowrie SSH Honeypot',
            type: 'cowrie',
            status: status.includes('Up') ? 'running' : 'stopped',
            uptime: this.parseUptime(status),
            connections: await this.getConnectionCount('cowrie'),
            attacks: await this.getAttackCount('cowrie'),
            ports: [2222, 2223],
          });
        } else if (name.includes('dionaea')) {
          statuses.push({
            name: 'Dionaea Multi-Protocol',
            type: 'dionaea',
            status: status.includes('Up') ? 'running' : 'stopped',
            uptime: this.parseUptime(status),
            connections: await this.getConnectionCount('dionaea'),
            attacks: await this.getAttackCount('dionaea'),
            ports: [21, 42, 135, 445, 1433, 3306, 5060],
          });
        } else if (name.includes('zeek')) {
          statuses.push({
            name: 'Zeek Network Monitor',
            type: 'zeek',
            status: status.includes('Up') ? 'running' : 'stopped',
            uptime: this.parseUptime(status),
            connections: await this.getConnectionCount('zeek'),
            attacks: 0,
            ports: [],
          });
        }
      }
      
      return statuses;
    } catch (error) {
      console.error('Failed to get honeypot status:', error);
      return [];
    }
  }
  
  /**
   * Get recent attack events from Elasticsearch
   */
  async getRecentAttacks(limit: number = 50): Promise<AttackEvent[]> {
    try {
      const response = await axios.post(
        `${this.elasticsearchUrl}/honeypot-*/_search`,
        {
          size: limit,
          sort: [{ '@timestamp': { order: 'desc' } }],
          query: {
            bool: {
              must: [
                { range: { '@timestamp': { gte: 'now-24h' } } }
              ]
            }
          }
        }
      );
      
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
  
  /**
   * Get attack statistics
   */
  async getAttackStats(): Promise<any> {
    try {
      const response = await axios.post(
        `${this.elasticsearchUrl}/honeypot-*/_search`,
        {
          size: 0,
          query: {
            range: { '@timestamp': { gte: 'now-7d' } }
          },
          aggs: {
            attacks_over_time: {
              date_histogram: {
                field: '@timestamp',
                calendar_interval: 'hour'
              }
            },
            top_attackers: {
              terms: {
                field: 'src_ip.keyword',
                size: 10
              }
            },
            top_protocols: {
              terms: {
                field: 'protocol.keyword',
                size: 10
              }
            },
            countries: {
              terms: {
                field: 'geoip.country_name.keyword',
                size: 10
              }
            }
          }
        }
      );
      
      return {
        total: response.data.hits.total.value,
        timeline: response.data.aggregations.attacks_over_time.buckets,
        topAttackers: response.data.aggregations.top_attackers.buckets,
        topProtocols: response.data.aggregations.top_protocols.buckets,
        countries: response.data.aggregations.countries.buckets,
      };
    } catch (error) {
      console.error('Failed to get attack stats:', error);
      return null;
    }
  }
  
  /**
   * Start a honeypot
   */
  async startHoneypot(type: string): Promise<{ success: boolean; message: string }> {
    try {
      const containerName = `cyberx-${type}`;
      await execAsync(`docker start ${containerName}`);
      return {
        success: true,
        message: `${type} honeypot started successfully`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to start ${type}: ${error.message}`,
      };
    }
  }
  
  /**
   * Stop a honeypot
   */
  async stopHoneypot(type: string): Promise<{ success: boolean; message: string }> {
    try {
      const containerName = `cyberx-${type}`;
      await execAsync(`docker stop ${containerName}`);
      return {
        success: true,
        message: `${type} honeypot stopped successfully`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to stop ${type}: ${error.message}`,
      };
    }
  }
  
  /**
   * Helper: Parse uptime from Docker status
   */
  private parseUptime(status: string): number {
    const match = status.match(/Up (\d+) (second|minute|hour|day)s?/);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'second': return value;
      case 'minute': return value * 60;
      case 'hour': return value * 3600;
      case 'day': return value * 86400;
      default: return 0;
    }
  }
  
  /**
   * Helper: Get connection count from Elasticsearch
   */
  private async getConnectionCount(honeypotType: string): Promise<number> {
    try {
      const response = await axios.post(
        `${this.elasticsearchUrl}/honeypot-${honeypotType}-*/_count`,
        {
          query: {
            range: { '@timestamp': { gte: 'now-1h' } }
          }
        }
      );
      return response.data.count;
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * Helper: Get attack count from Elasticsearch
   */
  private async getAttackCount(honeypotType: string): Promise<number> {
    try {
      const response = await axios.post(
        `${this.elasticsearchUrl}/honeypot-${honeypotType}-*/_count`,
        {
          query: {
            range: { '@timestamp': { gte: 'now-24h' } }
          }
        }
      );
      return response.data.count;
    } catch (error) {
      return 0;
    }
  }
}

export default new HoneypotManager();
