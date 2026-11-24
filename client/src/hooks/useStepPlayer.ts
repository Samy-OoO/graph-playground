import { useCallback, useEffect, useState } from 'react';
import { clamp } from '../utils/math';

/** Plays through a list of steps: play/pause, next/previous, scrub, reset. */
export function useStepPlayer<T>(delayMs: number) {
  const [steps, setSteps] = useState<T[]>([]);
  const [index, setIndex] = useState(0);
  const [playRequested, setPlayRequested] = useState(false);

  const lastIndex = steps.length - 1;
  // Reaching the final step stops playback by itself, so no effect has to switch it off.
  const isPlaying = playRequested && index < lastIndex;

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setTimeout(() => setIndex((i) => Math.min(i + 1, lastIndex)), delayMs);
    return () => window.clearTimeout(timer);
  }, [isPlaying, index, lastIndex, delayMs]);

  const load = useCallback((nextSteps: T[]) => {
    setSteps(nextSteps);
    setIndex(0);
    setPlayRequested(false);
  }, []);

  const clear = useCallback(() => load([]), [load]);

  const seek = useCallback(
    (target: number) => {
      setPlayRequested(false);
      setIndex(clamp(target, 0, Math.max(steps.length - 1, 0)));
    },
    [steps.length],
  );

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      setPlayRequested(false);
      return;
    }
    // Pressing play on the last step starts over.
    if (index >= lastIndex) setIndex(0);
    setPlayRequested(true);
  }, [isPlaying, index, lastIndex]);

  return {
    steps,
    index,
    currentStep: steps[index] ?? null,
    hasSteps: steps.length > 0,
    isPlaying,
    isFirst: index === 0,
    isLast: index >= lastIndex,
    load,
    clear,
    seek,
    reset: () => seek(0),
    next: () => seek(index + 1),
    previous: () => seek(index - 1),
    togglePlay,
  };
}
