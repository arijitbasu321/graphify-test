'use client';

import { useEffect, useRef, useState } from 'react';
import { formatNumber } from '@/lib/format';

type Props = { value: number; durationMs?: number; className?: string };

export function CountUp({ value, durationMs = 150, className }: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (display === value) return;
    fromRef.current = display;
    startRef.current = null;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    const tick = (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const elapsed = t - startRef.current;
      const k = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - k, 3);
      const next = Math.round(fromRef.current + (value - fromRef.current) * eased);
      setDisplay(next);
      if (k < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  return <span className={className}>{formatNumber(display)}</span>;
}
