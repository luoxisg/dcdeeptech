import { useEffect } from 'react';
import { useStore } from '../store';
import type { GpuMetric } from '../types';

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function walk(current: number, delta: number, min: number, max: number) {
  return clamp(current + (Math.random() - 0.5) * 2 * delta, min, max);
}

/**
 * Mounted once at App level — drives live GPU metrics for all online nodes
 * via a single 1-second setInterval (never one timer per card).
 */
export function useMetricsSimulator() {
  const nodes = useStore((s) => s.nodes);
  const appendNodeMetric = useStore((s) => s.appendNodeMetric);
  const appendReqRate = useStore((s) => s.appendReqRate);
  const updateHealth = useStore((s) => s.updateHealth);

  useEffect(() => {
    // Seed current metric values so the random walk starts from real data
    const state: Record<string, GpuMetric & { tpsBase: number }> = {};
    for (const n of nodes) {
      state[n.id] = { ...n.currentMetric, tpsBase: n.currentMetric.tps };
    }

    const id = setInterval(() => {
      for (const n of nodes) {
        if (n.status !== 'running') continue;
        const prev = state[n.id];

        const utilization = Math.round(walk(prev.utilization, 5, 15, 99));
        const vramUsedGb = parseFloat(
          walk(prev.vramUsedGb, 0.3, prev.vramTotalGb * 0.3, prev.vramTotalGb * 0.94).toFixed(1),
        );
        const temperatureC = Math.round(walk(prev.temperatureC, 1.5, 38, 90));
        const powerWatts = Math.round(walk(prev.powerWatts, 15, 60, 480));
        const tps = Math.round(walk(prev.tps, 8, 10, 220));

        const metric: GpuMetric = {
          timestamp: Date.now(),
          utilization,
          vramUsedGb,
          vramTotalGb: prev.vramTotalGb,
          temperatureC,
          powerWatts,
          tps,
        };

        state[n.id] = { ...metric, tpsBase: prev.tpsBase };
        appendNodeMetric(n.id, metric);
      }

      // Update request rate (every 5 ticks → ~5 sec)
      if (Math.random() < 0.2) {
        const reqs = Math.round(80 + Math.random() * 120);
        const errs = Math.round(Math.random() * 5);
        appendReqRate(reqs, errs);
        updateHealth({ totalRequests: undefined });
      }

      // Tick uptime
      updateHealth({ uptime: undefined });
    }, 1000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — runs once, reads initial node list
}
