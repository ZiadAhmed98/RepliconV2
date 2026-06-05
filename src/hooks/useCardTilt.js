import { useRef, useCallback } from 'react';

/**
 * Tracks mouse position over a card and applies a subtle 3D perspective tilt.
 * Also exposes --glow-x / --glow-y CSS vars so cards can show a radial inner light.
 */
export function useCardTilt({ max = 7, scale = 1.015 } = {}) {
  const ref  = useRef(null);
  const raf  = useRef(null);

  const handleMove = useCallback((e) => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const { left, top, width, height } = el.getBoundingClientRect();
      const x = (e.clientX - left) / width  - 0.5;   // -0.5 → +0.5
      const y = (e.clientY - top)  / height - 0.5;
      el.style.transform  = `perspective(900px) rotateY(${x * max * 2}deg) rotateX(${-y * max * 2}deg) scale(${scale}) translateZ(0)`;
      el.style.setProperty('--glow-x', `${(x + 0.5) * 100}%`);
      el.style.setProperty('--glow-y', `${(y + 0.5) * 100}%`);
    });
  }, [max, scale]);

  const handleLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = 'transform 0.55s cubic-bezier(0.2,0.8,0.2,1)';
    el.style.transform  = '';
    el.style.removeProperty('--glow-x');
    el.style.removeProperty('--glow-y');
    setTimeout(() => { if (el) el.style.transition = ''; }, 560);
  }, []);

  const handleEnter = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = 'transform 0.12s ease';
  }, []);

  return { ref, onMouseMove: handleMove, onMouseLeave: handleLeave, onMouseEnter: handleEnter };
}
