'use client';
import { motion } from 'framer-motion';

const EXAMPLES = [
  "Gaming laptop under ₹80k",
  "Wireless earbuds for gym",
  "Smartwatch under ₹10,000",
  "4K OLED TV under ₹60,000",
  "Samsung Galaxy S24 Ultra",
  "Noise cancelling headphones Sony",
  "PlayStation 5 disc edition",
  "MacBook Air M3 Base Model"
];

export function ExampleQueriesMarquee() {
  return (
    <div className="w-full overflow-hidden flex items-center relative mt-8 pt-4 pb-4 animate-fade-in-up">
       <div className="absolute left-0 w-32 h-full bg-gradient-to-r from-[#050508] to-transparent z-10 pointer-events-none" />
       <div className="absolute right-0 w-32 h-full bg-gradient-to-l from-[#050508] to-transparent z-10 pointer-events-none" />
       
       <div className="flex w-max animate-[marquee-left_40s_linear_infinite] gap-4 pointer-events-auto hover:[animation-play-state:paused]">
          {[...EXAMPLES, ...EXAMPLES, ...EXAMPLES].map((ex, i) => (
             <button
                key={i}
                onClick={() => {
                   window.location.href = `/search?q=${encodeURIComponent(ex)}`;
                }}
                className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/5 backdrop-blur-xl px-6 py-4 text-sm font-medium text-zinc-300 transition-all cursor-pointer hover:border-violet-500/50 hover:bg-violet-500/10 shrink-0 shadow-lg hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] flex items-center gap-3"
             >
                {/* sweeping highlight */}
                <div className="absolute inset-0 -translate-x-[150%] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[150%]" />
                
                <div className="w-8 h-8 rounded-full bg-black/50 border border-white/10 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-violet-400 group-hover:text-violet-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                
                <span className="relative z-10 whitespace-nowrap">
                  Searched: <span className="text-white font-semibold">{ex}</span>
                </span>
             </button>
          ))}
       </div>
    </div>
  );
}
