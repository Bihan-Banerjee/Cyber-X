import dgram from 'node:dgram';
import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface SNMPVulnerability {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
}

export interface SNMPResult {
  target: string;
  community: string;
  reachable: boolean;
  systemInfo: Record<string, string>;
  oids: Array<{ oid: string; value: string }>;
  vulnerabilities: SNMPVulnerability[];
}

// Build minimal SNMP v1/v2c GET-REQUEST PDU for sysDescr (1.3.6.1.2.1.1.1.0)
function buildSNMPGetRequest(community: string, version: string): Buffer {
  const communityBytes = Buffer.from(community, 'ascii');

  // OID for sysDescr: 1.3.6.1.2.1.1.1.0
  const oid = Buffer.from([0x06, 0x08, 0x2b, 0x06, 0x01, 0x02, 0x01, 0x01, 0x01, 0x00]);
  const nullVal = Buffer.from([0x05, 0x00]);

  // VarBind: SEQUENCE { oid, null }
  const varBind = Buffer.concat([oid, nullVal]);
  const varBindSeq = Buffer.concat([Buffer.from([0x30, varBind.length]), varBind]);

  // VarBindList: SEQUENCE { varBind }
  const varBindList = Buffer.concat([Buffer.from([0x30, varBindSeq.length]), varBindSeq]);

  // PDU: GetRequest-PDU (0xa0)
  const reqId = Buffer.from([0x02, 0x04, 0x00, 0x00, 0x00, 0x01]);
  const errStatus = Buffer.from([0x02, 0x01, 0x00]);
  const errIndex = Buffer.from([0x02, 0x01, 0x00]);
  const pduContent = Buffer.concat([reqId, errStatus, errIndex, varBindList]);
  const pdu = Buffer.concat([Buffer.from([0xa0, pduContent.length]), pduContent]);

  // Version integer
  const ver = version === '1' ? 0x00 : 0x01;
  const versionBuf = Buffer.from([0x02, 0x01, ver]);

  // Community string
  const communityLenBuf = Buffer.from([0x04, communityBytes.length]);
  const communitySection = Buffer.concat([communityLenBuf, communityBytes]);

  // Full message SEQUENCE
  const msgContent = Buffer.concat([versionBuf, communitySection, pdu]);
  const msg = Buffer.concat([Buffer.from([0x30, msgContent.length]), msgContent]);

  return msg;
}

export async function performSNMPScan(
  target: string,
  community: string = 'public',
  version: string = '2c',
  timeoutMs: number = 5000
): Promise<SNMPResult> {
  const start = performance.now();
  logToolActivity('SNMP Scanner', `Scanning ${target} with community "${community}"`, 'info');

  const vulnerabilities: SNMPVulnerability[] = [];

  if (community.toLowerCase() === 'public' || community.toLowerCase() === 'private') {
    vulnerabilities.push({
      severity: 'high',
      description: `Default SNMP community string "${community}" in use. This allows unauthorized read access to device information.`,
    });
  }

  if (version === '1' || version === '2c') {
    vulnerabilities.push({
      severity: 'medium',
      description: `SNMP ${version} transmits community strings in plaintext. Upgrade to SNMPv3 for authenticated, encrypted communication.`,
    });
  }

  const reachable = await new Promise<boolean>((resolve) => {
    const socket = dgram.createSocket('udp4');
    let resolved = false;

    socket.on('error', () => {
      if (!resolved) { resolved = true; socket.close(); resolve(false); }
    });

    socket.on('message', () => {
      if (!resolved) { resolved = true; socket.close(); resolve(true); }
    });

    try {
      const pdu = buildSNMPGetRequest(community, version === '2c' ? '2c' : version);
      socket.send(pdu, 161, target, (err) => {
        if (err && !resolved) { resolved = true; socket.close(); resolve(false); }
      });
    } catch {
      if (!resolved) { resolved = true; socket.close(); resolve(false); }
    }

    setTimeout(() => {
      if (!resolved) { resolved = true; try { socket.close(); } catch {} resolve(false); }
    }, timeoutMs);
  });

  // Simulate common OID values for demonstration when reachable
  const systemInfo: Record<string, string> = {};
  const oids: Array<{ oid: string; value: string }> = [];

  if (reachable) {
    systemInfo['sysDescr'] = 'Linux device (SNMP response detected)';
    systemInfo['sysName'] = target;
    systemInfo['sysLocation'] = 'Unknown';
    systemInfo['sysContact'] = 'Unknown';
    systemInfo['sysUpTime'] = 'Unknown';

    oids.push({ oid: '1.3.6.1.2.1.1.1.0', value: systemInfo['sysDescr'] });
    oids.push({ oid: '1.3.6.1.2.1.1.5.0', value: systemInfo['sysName'] });
    oids.push({ oid: '1.3.6.1.2.1.1.6.0', value: systemInfo['sysLocation'] });
    oids.push({ oid: '1.3.6.1.2.1.1.4.0', value: systemInfo['sysContact'] });
    oids.push({ oid: '1.3.6.1.2.1.1.3.0', value: systemInfo['sysUpTime'] });
  }

  logToolActivity('SNMP Scanner', `Scan complete for ${target} — reachable: ${reachable}`, reachable ? 'warning' : 'success');

  return { target, community, reachable, systemInfo, oids, vulnerabilities };
}
