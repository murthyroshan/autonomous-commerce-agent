'use client';
import { motion, useSpring } from 'framer-motion';
import { useEffect } from 'react';

export function CursorGlow() {
  const springConfig = { damping: 30, stiffness: 100 };
  const cursorX = useSpring(-500, springConfig);
  const cursorY = useSpring(-500, springConfig);

  useEffect(() => {
    let ticking = false;

    const moveCursor = (e: MouseEvent) => {
      if (!ticking) {
        requestAnimationFrame(() => {
          cursorX.set(e.clientX - 200); // Offset by half to center
          cursorY.set(e.clientY - 200);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('mousemove', moveCursor, { passive: true });
    return () => window.removeEventListener('mousemove', moveCursor);
  }, []);

  return (
    <motion.div
      className="pointer-events-none fixed top-0 left-0 w-[400px] h-[400px] rounded-full blur-[100px] bg-violet-600/15 z-0 mix-blend-screen"
      style={{
        x: cursorX,
        y: cursorY,
      }}
    />
  );
}
