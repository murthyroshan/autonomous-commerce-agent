'use client';
import { useState, useEffect } from 'react';

export function FlippingProductCard({ item }: { item: any }) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const randomDelay = Math.random() * 10000 + 5000;
    const interval = setInterval(() => {
      setFlipped(true);
      setTimeout(() => setFlipped(false), 3000);
    }, randomDelay);

    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      className="relative w-[340px] h-[180px] flex-shrink-0 group perspective-[1200px] mx-4 my-2"
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
    >
      <div 
        className="w-full h-full relative"
        style={{ 
           transformStyle: 'preserve-3d', 
           transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
           transform: flipped ? 'rotateX(180deg)' : 'rotateX(0deg)'
        }}
      >
        {/* FRONT */}
        <div 
          className="absolute inset-0 bg-black/90 border border-violet-500/20 rounded-2xl p-5 flex flex-col justify-between overflow-hidden transition-all duration-300"
          style={{ 
             backfaceVisibility: 'hidden',
             willChange: 'transform',
             boxShadow: item.hotDeal ? '0 0 25px rgba(34,197,94,0.15), inset 0 0 15px rgba(139,92,246,0.1)' : 'none'
          }}
        >
          {item.hotDeal && (
             <div className="absolute -top-10 -right-10 w-24 h-24 bg-green-500/20 blur-2xl rounded-full" />
          )}

          <div className="flex justify-between items-start relative z-10">
             <div className="flex flex-col gap-1">
               <h3 className="text-white font-semibold line-clamp-1">{item.title}</h3>
               <p className="text-violet-400/80 text-xs tracking-wider uppercase font-semibold">{item.source}</p>
             </div>
             {item.hotDeal && (
                <span className="px-2 py-1 bg-green-950/40 text-green-400 text-[10px] font-bold rounded flex items-center justify-center uppercase tracking-wider relative z-10 border border-green-500/30 shrink-0 shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                  HOT DEAL
                </span>
             )}
          </div>

          <div className="flex justify-between items-end relative z-10">
            <p className="text-3xl font-bold text-white tracking-tighter">{item.price}</p>
            <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded">
               <span className="text-yellow-400 text-xs">★</span>
               <span className="text-zinc-300 text-xs font-medium">{item.rating}</span>
            </div>
          </div>
        </div>

        {/* BACK */}
        <div 
          className="absolute inset-0 bg-indigo-950/95 border border-indigo-400/30 rounded-2xl p-5 flex flex-col"
          style={{ 
            backfaceVisibility: 'hidden', 
            willChange: 'transform',
            transform: 'rotateX(180deg)' 
          }}
        >
           <div className="flex justify-between items-center border-b border-indigo-500/30 pb-2 mb-3">
             <h4 className="text-xs font-mono text-indigo-300 uppercase tracking-widest">AI Reasoning Layer</h4>
             <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
           </div>
           
           <div className="flex flex-col gap-2 flex-grow justify-center font-mono text-xs">
             <div className="flex justify-between items-center">
                <span className="text-indigo-200/60">Price_Norm</span>
                <span className="text-indigo-100">{item.priceScore}</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-indigo-200/60">Trust_Tier</span>
                <span className="text-indigo-100">{item.trustTier}</span>
             </div>
             <div className="flex justify-between items-center bg-black/30 p-2 rounded mt-1 border border-indigo-500/10">
                <span className="text-indigo-200/60">Final_Vector</span>
                <span className={item.hotDeal ? "text-green-400 font-bold" : "text-violet-300 font-bold"}>{item.verdict}</span>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
