'use client';
import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

const format = new Intl.NumberFormat('pt-BR');

export function CountUp({ value }: { value: number }) {
  const element = useRef<HTMLSpanElement>(null);
  const visible = useInView(element, { once: true });
  const reduced = useReducedMotion();
  useEffect(() => {
    const node = element.current;
    if (!node || !visible || reduced || value === 0) return;
    const controls = animate(0, value, {
      duration: Math.min(1.4, 0.5 + value / 200),
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        node.textContent = format.format(Math.round(latest));
      },
    });
    return () => controls.stop();
  }, [visible, reduced, value]);
  return <span ref={element}>{format.format(value)}</span>;
}
