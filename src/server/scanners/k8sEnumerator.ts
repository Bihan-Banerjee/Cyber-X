import { performance } from 'node:perf_hooks';

export interface K8sResource {
  type: string;
  name: string;
  namespace: string;
  status: string;
  issues: string[];
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

export interface K8sMisconfiguration {
  category: string;
  issue: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  resource: string;
  description: string;
  recommendation: string;
}

export interface K8sEnumerationResult {
  clusterName: string;
  version: string;
  totalResources: number;
  namespaces: string[];
  resources: K8sResource[];
  misconfigurations: K8sMisconfiguration[];
  securityScore: number;
  riskLevel: string;
  findings: {
    privilegedPods: number;
    exposedSecrets: number;
    publicServices: number;
    missingRBAC: number;
    insecureConfigs: number;
  };
  scanDuration: number;
}

/**
 * Generate mock K8s resources
 */
function generateMockResources(): K8sResource[] {
  const resources: K8sResource[] = [];
  
  const namespaces = ['default', 'kube-system', 'production', 'staging'];
  const podTypes = ['nginx', 'redis', 'postgres', 'api-server', 'frontend', 'backend'];
  
  // Generate pods
  for (let i = 0; i < 15; i++) {
    const namespace = namespaces[Math.floor(Math.random() * namespaces.length)];
    const podType = podTypes[Math.floor(Math.random() * podTypes.length)];
    const isPrivileged = Math.random() > 0.7;
    const hasSecurityIssues = Math.random() > 0.6;
    
    const issues: string[] = [];
    if (isPrivileged) issues.push('Running as privileged');
    if (hasSecurityIssues) issues.push('No security context defined');
    if (Math.random() > 0.8) issues.push('Using default service account');
    
    resources.push({
      type: 'Pod',
      name: `${podType}-${Math.random().toString(36).substr(2, 9)}`,
      namespace,
      status: 'Running',
      issues,
      severity: isPrivileged ? 'critical' : issues.length > 0 ? 'high' : 'low',
    });
  }
  
  // Generate services
  for (let i = 0; i < 8; i++) {
    const namespace = namespaces[Math.floor(Math.random() * namespaces.length)];
    const isPublic = Math.random() > 0.6;
    
    resources.push({
      type: 'Service',
      name: `service-${i}`,
      namespace,
      status: 'Active',
      issues: isPublic ? ['Exposed to public internet'] : [],
      severity: isPublic ? 'high' : 'low',
    });
  }
  
  // Generate secrets
  for (let i = 0; i < 5; i++) {
    const namespace = namespaces[Math.floor(Math.random() * namespaces.length)];
    const isExposed = Math.random() > 0.7;
    
    resources.push({
      type: 'Secret',
      name: `secret-${i}`,
      namespace,
      status: 'Active',
      issues: isExposed ? ['Accessible without proper RBAC'] : [],
      severity: isExposed ? 'critical' : 'medium',
    });
  }
  
  return resources;
}

/**
 * Generate misconfigurations based on resources
 */
function generateMisconfigurations(resources: K8sResource[]): K8sMisconfiguration[] {
  const misconfigs: K8sMisconfiguration[] = [];
  
  // RBAC issues
  if (Math.random() > 0.5) {
    misconfigs.push({
      category: 'RBAC',
      issue: 'Overly Permissive ClusterRole',
      severity: 'high',
      resource: 'ClusterRole/cluster-admin',
      description: 'ClusterRole grants excessive permissions including cluster-admin access',
      recommendation: 'Apply principle of least privilege. Create specific roles with minimal required permissions',
    });
  }
  
  // Pod security
  const privilegedPods = resources.filter(r => r.issues.includes('Running as privileged'));
  privilegedPods.forEach(pod => {
    misconfigs.push({
      category: 'Pod Security',
      issue: 'Privileged Pod Detected',
      severity: 'critical',
      resource: `${pod.namespace}/${pod.name}`,
      description: 'Pod is running with privileged security context, allowing full host access',
      recommendation: 'Remove privileged flag. Use specific capabilities instead of full privileges',
    });
  });
  
  // Network policies
  if (Math.random() > 0.6) {
    misconfigs.push({
      category: 'Network Security',
      issue: 'Missing Network Policies',
      severity: 'medium',
      resource: 'namespace/production',
      description: 'No NetworkPolicies defined, allowing unrestricted pod-to-pod communication',
      recommendation: 'Implement NetworkPolicies to restrict traffic between pods and namespaces',
    });
  }
  
  // Secrets management
  if (Math.random() > 0.5) {
    misconfigs.push({
      category: 'Secrets Management',
      issue: 'Secrets Not Encrypted at Rest',
      severity: 'high',
      resource: 'etcd',
      description: 'Kubernetes secrets are not encrypted at rest in etcd',
      recommendation: 'Enable encryption at rest for secrets using EncryptionConfiguration',
    });
  }
  
  // API server security
  misconfigs.push({
    category: 'API Server',
    issue: 'Anonymous Authentication Enabled',
    severity: 'high',
    resource: 'kube-apiserver',
    description: 'API server allows anonymous requests',
    recommendation: 'Disable anonymous authentication with --anonymous-auth=false',
  });
  
  // Admission controllers
  if (Math.random() > 0.7) {
    misconfigs.push({
      category: 'Admission Control',
      issue: 'PodSecurityPolicy Not Enforced',
      severity: 'medium',
      resource: 'admission-controller',
      description: 'PodSecurityPolicy admission controller is not enabled',
      recommendation: 'Enable and configure PodSecurityPolicy or use Pod Security Standards',
    });
  }
  
  // Resource limits
  misconfigs.push({
    category: 'Resource Management',
    issue: 'Missing Resource Limits',
    severity: 'low',
    resource: 'namespace/default',
    description: 'Pods running without CPU/memory limits can cause resource exhaustion',
    recommendation: 'Define ResourceQuotas and LimitRanges for all namespaces',
  });
  
  return misconfigs;
}

/**
 * Calculate security score
 */
function calculateSecurityScore(misconfigs: K8sMisconfiguration[]): number {
  let score = 100;
  
  misconfigs.forEach(m => {
    switch (m.severity) {
      case 'critical': score -= 15; break;
      case 'high': score -= 10; break;
      case 'medium': score -= 5; break;
      case 'low': score -= 2; break;
    }
  });
  
  return Math.max(0, score);
}

/**
 * Perform K8s enumeration
 */
export async function performK8sEnumeration(
  apiEndpoint: string,
  token?: string,
  timeoutMs: number = 30000
): Promise<K8sEnumerationResult> {
  const startTime = performance.now();
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Generate mock data
  const resources = generateMockResources();
  const misconfigurations = generateMisconfigurations(resources);
  
  const namespaces = ['default', 'kube-system', 'production', 'staging', 'monitoring'];
  
  const findings = {
    privilegedPods: resources.filter(r => r.type === 'Pod' && r.issues.includes('Running as privileged')).length,
    exposedSecrets: resources.filter(r => r.type === 'Secret' && r.issues.length > 0).length,
    publicServices: resources.filter(r => r.type === 'Service' && r.issues.length > 0).length,
    missingRBAC: misconfigurations.filter(m => m.category === 'RBAC').length,
    insecureConfigs: misconfigurations.filter(m => m.category !== 'RBAC').length,
  };
  
  const securityScore = calculateSecurityScore(misconfigurations);
  const riskLevel = 
    securityScore >= 80 ? 'LOW' :
    securityScore >= 60 ? 'MEDIUM' :
    securityScore >= 40 ? 'HIGH' : 'CRITICAL';
  
  const scanDuration = Math.round((performance.now() - startTime) / 1000);
  
  return {
    clusterName: 'production-cluster',
    version: '1.28.3',
    totalResources: resources.length,
    namespaces,
    resources,
    misconfigurations,
    securityScore,
    riskLevel,
    findings,
    scanDuration,
  };
}
