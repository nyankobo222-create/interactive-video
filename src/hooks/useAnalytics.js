import { useRef, useCallback } from "react";

export function useAnalytics(projectId) {
  const sessionId = useRef(Math.random().toString(36).slice(2, 10));
  const startTime = useRef(Date.now());

  const send = useCallback(async (type, data = {}) => {
    try {
      await fetch(`/api/analytics/${projectId}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          sessionId: sessionId.current,
          timestamp: new Date().toISOString(),
          ...data,
        }),
      });
    } catch {}
  }, [projectId]);

  const elapsed = useCallback(
    () => Math.round((Date.now() - startTime.current) / 1000),
    []
  );

  return { send, elapsed };
}
