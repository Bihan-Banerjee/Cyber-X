import { performance } from 'node:perf_hooks';
import { logToolActivity } from '../utils/activityLogger.js';

export interface IAMIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  statementIndex?: number;
  affectedStatement?: string;
}

export interface IAMAuditResult {
  issues: IAMIssue[];
  score: number;
  wildcardStatements: number;
  dangerousActions: string[];
}

const DANGEROUS_ACTIONS = [
  'iam:*',
  'iam:CreateUser',
  'iam:CreateAccessKey',
  'iam:AttachRolePolicy',
  'iam:PutUserPolicy',
  's3:*',
  'ec2:*',
  'sts:AssumeRole',
  'secretsmanager:*',
  'kms:*',
  'lambda:*',
  'cloudformation:*',
  'organizations:*',
];

function hasMFACondition(statement: any): boolean {
  const conditions = statement.Condition;
  if (!conditions) return false;
  return JSON.stringify(conditions).toLowerCase().includes('mfa');
}

export function auditIAMPolicy(policyJson: string): IAMAuditResult {
  logToolActivity('IAM Auditor', `Auditing IAM policy`, 'info');

  let policy: any;
  try {
    policy = JSON.parse(policyJson);
  } catch {
    throw new Error('Invalid JSON — could not parse IAM policy');
  }

  const statements: any[] = policy.Statement ?? policy.statement ?? [];
  if (!Array.isArray(statements)) {
    throw new Error('Policy must contain a Statement array');
  }

  const issues: IAMIssue[] = [];
  let wildcardStatements = 0;
  const foundDangerousActions = new Set<string>();
  let scoreDeduction = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const effect = stmt.Effect ?? stmt.effect ?? 'Allow';
    if (effect !== 'Allow') continue;

    const actions: string[] = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action ?? '*'];
    const resources: string[] = Array.isArray(stmt.Resource) ? stmt.Resource : [stmt.Resource ?? '*'];
    const principals = stmt.Principal;

    const hasWildcardAction = actions.some((a) => a === '*' || a === 'aws:*');
    const hasWildcardResource = resources.some((r) => r === '*');

    if (hasWildcardAction) wildcardStatements++;

    const stmtStr = JSON.stringify(stmt, null, 2);

    // Critical: Allow * on *
    if (hasWildcardAction && hasWildcardResource) {
      issues.push({
        severity: 'critical',
        title: 'Full Administrative Access (Allow *:* on *)',
        description: 'Statement grants unrestricted access to all AWS services and resources. This is equivalent to root access.',
        statementIndex: i,
        affectedStatement: stmtStr,
      });
      scoreDeduction += 40;
    }
    // High: wildcard action
    else if (hasWildcardAction && !hasWildcardResource) {
      issues.push({
        severity: 'high',
        title: 'Wildcard Action',
        description: 'Statement allows all actions (*) on specific resources. Restrict to required actions only.',
        statementIndex: i,
        affectedStatement: stmtStr,
      });
      scoreDeduction += 20;
    }
    // High: wildcard resource without condition
    else if (hasWildcardResource && !hasMFACondition(stmt)) {
      issues.push({
        severity: 'high',
        title: 'Wildcard Resource Without Condition',
        description: 'Statement grants actions on all resources (*) without MFA or other conditions.',
        statementIndex: i,
        affectedStatement: stmtStr,
      });
      scoreDeduction += 15;
    }

    // Critical: Public principal
    if (principals === '*' || (Array.isArray(principals) && principals.includes('*'))) {
      issues.push({
        severity: 'critical',
        title: 'Public Principal (Principal: *)',
        description: 'Policy grants access to any AWS principal including anonymous internet access.',
        statementIndex: i,
        affectedStatement: stmtStr,
      });
      scoreDeduction += 40;
    }

    // Check for dangerous actions
    for (const action of actions) {
      const normalized = action.toLowerCase();
      for (const dangerous of DANGEROUS_ACTIONS) {
        if (normalized === dangerous.toLowerCase() ||
            (dangerous.endsWith(':*') && normalized.startsWith(dangerous.slice(0, -1).toLowerCase()))) {
          foundDangerousActions.add(action);
          if (!hasWildcardAction) {
            issues.push({
              severity: 'medium',
              title: `Dangerous Action: ${action}`,
              description: `Action "${action}" can be used for privilege escalation or data exfiltration.`,
              statementIndex: i,
            });
            scoreDeduction += 10;
          }
        }
      }
    }

    // Sensitive actions without MFA
    const sensitivePrefixes = ['iam:', 'sts:', 'secretsmanager:', 'kms:'];
    const hasSensitiveAction = actions.some((a) => sensitivePrefixes.some((p) => a.toLowerCase().startsWith(p)));
    if (hasSensitiveAction && !hasMFACondition(stmt)) {
      issues.push({
        severity: 'medium',
        title: 'Sensitive Action Without MFA Condition',
        description: 'IAM, STS, Secrets Manager, or KMS actions are allowed without requiring MFA.',
        statementIndex: i,
      });
      scoreDeduction += 10;
    }
  }

  const score = Math.max(0, 100 - scoreDeduction);
  logToolActivity('IAM Auditor', `Audit complete — ${issues.length} issues, score: ${score}`, 'success');

  return {
    issues,
    score,
    wildcardStatements,
    dangerousActions: [...foundDangerousActions],
  };
}
