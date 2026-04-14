'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const CHARS = '0123456789ABCDEF!@#$%^&*()_+-=[]{}|;:,.<>?';

export function DecryptText({ 
  text, 
  speed = 30, 
  delay = 0, 
  className = "" 
}: { 
  text: string, 
  speed?: number, 
  delay?: number, 
  className?: string 
}) {
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    timeout = setTimeout(() => {
      let iteration = 0;
      const interval = setInterval(() => {
        setDisplayText(() => 
          text
            .split('')
            .map((letter, index) => {
              // Ignore whitespace
              if (letter === ' ') return ' ';
              if (index < iteration) {
                return text[index];
              }
              return CHARS[Math.floor(Math.random() * CHARS.length)];
            })
            .join('')
        );
        
        if (iteration >= text.length) {
          clearInterval(interval);
        }
        
        iteration += 1 / 3;
      }, speed);

      return () => clearInterval(interval);
    }, delay * 1000);

    return () => clearTimeout(timeout);
  }, [text, speed, delay]);

  return (
    <motion.span 
      className={`font-mono inline-block ${className}`} 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      transition={{ duration: 0.2 }}
    >
      {displayText || text.replace(/./g, '0')}
    </motion.span>
  );
}
