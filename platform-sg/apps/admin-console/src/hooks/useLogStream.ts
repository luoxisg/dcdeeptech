import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { generateLogEntry } from '../mockData';

/**
 * Continuously appends realistic log entries to the store.
 * Interval jitters between 200–800 ms to simulate real log bursts.
 */
export function useLogStream() {
  const appendLog = useStore((s) => s.appendLog);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function schedule() {
      const delay = 200 + Math.random() * 600;
      timeoutRef.current = setTimeout(() => {
        appendLog(generateLogEntry());
        schedule();
      }, delay);
    }
    schedule();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [appendLog]);
}
