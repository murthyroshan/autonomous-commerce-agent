'use client';
import React, { useRef, useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

export function PerspectiveWrapper({ 
  children, 
  active = true 
}: { 
  children: React.ReactNode, 
  active?: boolean 
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const mouseX = useSpring(0, { stiffness: 100, damping: 30 });
  const mouseY = useSpring(0, { stiffness: 100, damping: 30 });

  useEffect(() => {
    if (!active) {
      mouseX.set(0);
      mouseY.set(0);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      
      mouseX.set(nx);
      mouseY.set(ny);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [active, mouseX, mouseY]);

  const rotateX = useTransform(mouseY, [-1, 1], [4, -4]);
  const rotateY = useTransform(mouseX, [-1, 1], [-4, 4]);

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 overflow-hidden bg-black w-screen h-[200vh]"
      style={{ perspective: "2000px", zIndex: 0 }}
    >
      <motion.div
        className="w-full h-full origin-center relative"
        style={{
          rotateX: active ? rotateX : 0,
          rotateY: active ? rotateY : 0,
          transformStyle: "preserve-3d"
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
