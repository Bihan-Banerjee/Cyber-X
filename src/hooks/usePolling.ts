import { useEffect, useRef } from "react";

/**
 * Runs `callback` immediately and then every `intervalMs`, but only while the
 * browser tab is visible. When the tab is hidden the interval is torn down so no
 * idle network/CPU work happens in the background; when the tab becomes visible
 * again the callback fires once immediately and the interval resumes.
 *
 * Pass `enabled = false` to disable polling entirely (e.g. an auto-refresh
 * toggle). `deps` re-subscribes the poller when any of them change, mirroring a
 * useEffect dependency array.
 *
 * The latest `callback` is always used (stored in a ref) so intervals never fire
 * a stale closure — callers can pass an inline arrow without churning the timer.
 */
export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  deps: React.DependencyList = [],
  enabled = true,
) {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (!enabled) return;

    let id: ReturnType<typeof setInterval> | null = null;
    const tick = () => { void saved.current(); };

    const start = () => {
      if (id !== null) return;
      tick();
      id = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (id !== null) { clearInterval(id); id = null; }
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, enabled, ...deps]);
}
