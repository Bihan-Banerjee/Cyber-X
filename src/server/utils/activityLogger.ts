interface ToolActivity {
  toolName: string;
  timestamp: string;
  status: "success" | "warning" | "info";
  message: string;
}

// In-memory activity log (last 50 activities)
const activityLog: ToolActivity[] = [];
const MAX_LOG_SIZE = 50;

export function logToolActivity(
  toolName: string,
  message: string,
  status: "success" | "warning" | "info" = "info"
) {
  const activity: ToolActivity = {
    toolName,
    timestamp: new Date().toISOString(),
    status,
    message,
  };

  activityLog.unshift(activity);

  // Keep only last MAX_LOG_SIZE activities
  if (activityLog.length > MAX_LOG_SIZE) {
    activityLog.pop();
  }
}

export function getRecentToolActivity(limit: number = 10): ToolActivity[] {
  return activityLog.slice(0, limit);
}
