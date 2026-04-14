'use client';
import { motion } from 'framer-motion';

export function TerminalShowcase() {
  const jsonCode = `{
  "agent_id": "awk-848-core",
  "task": "autonomous_commerce",
  "state_payload": {
    "query": "Sony WH-1000XM5 under ₹25000",
    "search_results": [
      { "store": "Amazon", "price": 22990, "trust": 0.88 },
      { "store": "Croma", "price": 24500, "trust": 0.95 }
    ],
    "verification": "PASSED. 0 fake anomalies detected.",
    "normalization_weights": { "price": 0.45, "rating": 0.35, "trust": 0.20 },
    "final_verdict": {
      "selection": "Amazon",
      "reasoning": "Highest aggregate vector score (0.906)."
    },
    "blockchain_intent": "TX_LOCKED_ALGORAND_TESTNET"
  }
}`;

  return (
    <div className="w-full max-w-5xl mx-auto mt-32 mb-16 relative group cursor-text">
       <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 via-zinc-600 to-blue-600 rounded-3xl blur-2xl opacity-10 group-hover:opacity-30 transition duration-1000 pointer-events-none" />
       
       <div className="relative rounded-2xl border border-white/5 bg-[#030305] p-6 md:p-8 shadow-2xl overflow-hidden">
          <div className="flex border-b border-white/5 pb-4 mb-6 items-center justify-between">
             <div className="flex gap-2.5">
                 <div className="w-3 h-3 rounded-full bg-[#ef4444]/60 border border-[#ef4444]/40" />
                 <div className="w-3 h-3 rounded-full bg-[#eab308]/60 border border-[#eab308]/40" />
                 <div className="w-3 h-3 rounded-full bg-[#22c55e]/60 border border-[#22c55e]/40" />
             </div>
             <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest border border-zinc-800 px-3 py-1 rounded-full">app/core/AgentState.json</span>
          </div>
          
          <pre className="font-mono text-xs md:text-[13px] text-violet-300/80 overflow-x-auto whitespace-pre-wrap leading-relaxed tracking-wider">
             <motion.div
               initial={{ clipPath: 'inset(0 100% 0 0)' }}
               whileInView={{ clipPath: 'inset(0 0% 0 0)' }}
               viewport={{ once: true, margin: "-100px" }}
               transition={{ duration: 1.5, ease: "easeOut" }}
             >
                {jsonCode}
             </motion.div>
          </pre>
       </div>
    </div>
  );
}
