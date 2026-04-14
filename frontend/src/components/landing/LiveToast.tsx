'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const NOTIFICATIONS = [
  { text: "AI just found a deal on Sony WH-1000XM5 — ₹18,990" },
  { text: "Agent negotiated 12% off ASUS ROG Laptops vs Croma MSRP" },
  { text: "Trust Engine banned 4 fake listings for Apple AirPods" },
  { text: "Algorand Escrow Contract successfully locked for user X9a..." },
  { text: "Price drop detected on LG C3 OLED 55\" at Reliance Digital" }
];

export function LiveToast() {
  const [activeToast, setActiveToast] = useState<{ text: string } | null>(null);

  useEffect(() => {
    const triggerRandomToast = () => {
      const toast = NOTIFICATIONS[Math.floor(Math.random() * NOTIFICATIONS.length)];
      setActiveToast(toast);
      
      setTimeout(() => {
        setActiveToast(null);
      }, 5000);
    };

    const interval = setInterval(triggerRandomToast, Math.random() * 8000 + 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
       <AnimatePresence>
          {activeToast && (
             <motion.div 
               initial={{ opacity: 0, y: 20, x: 20 }}
               animate={{ opacity: 1, y: 0, x: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 10 }}
               transition={{ type: "spring", stiffness: 300, damping: 25 }}
               className="bg-[#0a0a0f]/90 backdrop-blur-xl border border-indigo-500/30 p-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6),0_0_20px_rgba(99,102,241,0.15)] flex items-start gap-4 max-w-sm"
             >
                <div className="mt-1.5 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 border border-indigo-300 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                </div>
                <div>
                   <p className="text-[10px] font-mono text-indigo-400 mb-1.5 uppercase tracking-widest font-bold">Network Activity</p>
                   <p className="text-sm text-zinc-300 leading-snug">{activeToast.text}</p>
                </div>
             </motion.div>
          )}
       </AnimatePresence>
    </div>
  );
}
