'use client';
import { motion } from 'framer-motion';

export function BattleModeCard() {
  return (
    <div className="h-[450px] w-full rounded-2xl border border-violet-500/20 bg-[#0a0a0f]/80 backdrop-blur-xl shadow-2xl relative overflow-hidden group flex flex-col items-center justify-center p-4 md:p-8">
       <div className="absolute inset-0 top-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
       
       <h3 className="relative z-10 text-[10px] font-mono text-violet-400/80 uppercase tracking-widest mb-8 border border-violet-500/20 bg-indigo-950/40 px-4 py-1.5 rounded-full shadow-inner">
          Execution Profile: Battle Mode (Min-Max)
       </h3>

       <div className="w-full flex items-center justify-between gap-2 md:gap-4 relative px-2">
          
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-10 md:w-12 h-10 md:h-12 rounded-full bg-black/60 border border-violet-500/50 backdrop-blur-md z-20 shadow-[0_0_30px_rgba(139,92,246,0.3)]">
             <span className="font-bold text-violet-400 font-mono text-xs md:text-sm">VS</span>
          </div>

          {/* Left Product (Loser) */}
          <motion.div 
            initial={{ x: -30, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: false, margin: "-100px" }}
            transition={{ type: "spring", stiffness: 100 }}
            className="flex-1 bg-black/80 border border-zinc-800 rounded-xl p-4 md:p-5 flex flex-col gap-4 filter grayscale brightness-50 z-10 hover:grayscale-0 hover:brightness-100 transition-all cursor-crosshair"
          >
             <div className="text-zinc-600 font-semibold truncate text-sm md:text-base">Apple AirPods Max</div>
             
             <div className="space-y-3">
               <div>
                 <div className="flex justify-between text-[9px] uppercase font-mono text-zinc-600 mb-1"><span>Price vector</span><span>0.420</span></div>
                 <div className="h-1 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-zinc-700 w-[42%]" /></div>
               </div>
               <div>
                 <div className="flex justify-between text-[9px] uppercase font-mono text-zinc-600 mb-1"><span>Trust Vector</span><span>0.950</span></div>
                 <div className="h-1 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-zinc-700 w-[95%]" /></div>
               </div>
             </div>
             
             <div className="text-xl md:text-2xl font-black text-zinc-700 font-mono mt-2 flex justify-between items-end border-t border-white/5 pt-3">
                <span className="tracking-tighter">0.592</span>
                <span className="text-[10px] self-center">DECLINED</span>
             </div>
          </motion.div>

          {/* Right Product (Winner) */}
          <motion.div 
            initial={{ x: 30, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: false, margin: "-100px" }}
            transition={{ type: "spring", delay: 0.1, stiffness: 100 }}
            className="flex-1 bg-black border border-green-500/40 rounded-xl p-4 md:p-5 flex flex-col gap-4 shadow-[0_0_30px_rgba(34,197,94,0.1)] relative z-10 overflow-hidden cursor-crosshair"
          >
             <div className="absolute -inset-2 bg-green-500/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
             <div className="text-white font-semibold truncate text-sm md:text-base relative z-10">Sony WH-1000XM5</div>
             
             <div className="space-y-3 relative z-10">
               <div>
                 <div className="flex justify-between text-[9px] uppercase font-mono text-green-500/80 mb-1"><span>Price vector</span><motion.span initial={{ opacity: 0}} whileInView={{opacity: 1}} transition={{delay: 0.5}}>0.920</motion.span></div>
                 <div className="h-1 bg-zinc-900 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} whileInView={{ width: '92%' }} transition={{ duration: 1, ease: 'circOut' }} className="h-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,1)]" /></div>
               </div>
               <div>
                 <div className="flex justify-between text-[9px] uppercase font-mono text-green-500/80 mb-1"><span>Trust Vector</span><motion.span initial={{ opacity: 0}} whileInView={{opacity: 1}} transition={{delay: 0.6}}>0.880</motion.span></div>
                 <div className="h-1 bg-zinc-900 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} whileInView={{ width: '88%' }} transition={{ duration: 1, delay: 0.2, ease: 'circOut' }} className="h-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,1)]" /></div>
               </div>
             </div>
             
             <div className="text-xl md:text-3xl font-black text-green-400 font-mono mt-2 flex justify-between items-end border-t border-green-500/20 pt-3 relative z-10">
                <span className="tracking-tighter drop-shadow-md">0.906</span>
                <span className="text-[10px] self-center bg-green-500/20 border border-green-500/40 px-2 py-0.5 rounded text-green-300 tracking-wider">SELECTED</span>
             </div>
          </motion.div>
       </div>
    </div>
  );
}
