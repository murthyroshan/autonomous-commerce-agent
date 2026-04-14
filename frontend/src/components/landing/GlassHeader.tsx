'use client';
import { motion } from 'framer-motion';

export function GlassHeader() {
  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 py-3 md:px-6 md:py-4 mx-auto max-w-7xl mt-4"
    >
       <div className="absolute inset-0 bg-[#050508]/60 backdrop-blur-2xl rounded-full border border-violet-500/20 shadow-lg pointer-events-none mx-4" />
       
       <div className="relative flex items-center gap-3 z-10 w-full justify-between px-6">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
             <div className="w-2.5 h-2.5 bg-violet-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(139,92,246,0.9)]" />
             <span className="text-white font-black tracking-widest text-lg">KartIQ</span>
          </div>

          <div className="flex items-center gap-8">
             <a href="https://github.com/murthyroshan/autonomous-commerce-agent" target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-zinc-400 hidden md:block select-none cursor-pointer hover:text-violet-400 transition-colors uppercase tracking-widest">Architecture</a>
             <a href="https://lora.algokit.io/testnet" target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-zinc-400 hidden md:block select-none cursor-pointer hover:text-violet-400 transition-colors uppercase tracking-widest">Lora Explorer</a>
             
             <button 
                onClick={() => window.location.href = '/search'}
                className="bg-white hover:bg-zinc-200 text-black px-6 py-2 rounded-full font-bold text-xs uppercase tracking-widest transition-all hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
             >
                Start
             </button>
          </div>
       </div>
    </motion.header>
  );
}
