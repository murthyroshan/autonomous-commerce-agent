'use client';
import { motion } from 'framer-motion';

export function NegotiationCard() {
  const codeLines = [
    { line: "> Initializing negotiation engine against target nodes...", color: "text-zinc-500", delay: 0 },
    { line: "> Scraping Amazon dynamic payload for hidden coupons...", color: "text-blue-400", delay: 0.6 },
    { line: "> SUCCESS: Extracted 10% HDFC Instant Discount flag.", color: "text-green-400", delay: 1.4 },
    { line: "> Cross-referencing Croma MSRP (₹29,990) vs Amazon discounted...", color: "text-blue-400", delay: 2.2 },
    { line: "> VERDICT: Amazon wins by ₹2,400 spread. Selection confirmed.", color: "text-violet-400", delay: 3.0 },
    { line: "> Locking in final purchase intent on Algorand testnet.", color: "text-zinc-300 font-bold", delay: 3.8 }
  ];

  return (
    <div className="h-[450px] w-full rounded-2xl border border-blue-500/20 bg-[#050510]/95 backdrop-blur-xl shadow-2xl relative overflow-hidden group flex flex-col p-4 md:p-6 cursor-text">
       <div className="absolute inset-0 top-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
       
       <div className="flex justify-between items-center mb-6 border-b border-blue-500/10 pb-4">
         <h3 className="relative z-10 text-[10px] font-mono text-blue-400/80 uppercase tracking-widest bg-blue-950/40 px-4 py-1.5 rounded-full shadow-inner border border-blue-500/20">
            Execution Profile: Negotiation Logic
         </h3>
         <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.6)] animate-pulse" />
         </div>
       </div>

       <div className="flex-1 font-mono text-xs md:text-sm flex flex-col gap-4 mt-4">
          {codeLines.map((item, i) => (
             <motion.div 
               key={i}
               initial={{ opacity: 0, x: -10 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: false, margin: "-100px" }}
               transition={{ delay: item.delay, duration: 0.3 }}
               className={`${item.color} tracking-tight leading-relaxed`}
             >
               {item.line}
             </motion.div>
          ))}
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }}
            className="w-2 h-4 bg-blue-500 mt-2 inline-block shadow-[0_0_8px_rgba(59,130,246,0.8)]"
          />
       </div>
    </div>
  );
}
