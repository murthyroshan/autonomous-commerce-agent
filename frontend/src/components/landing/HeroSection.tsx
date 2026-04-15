'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FlippingProductCard } from './FlippingProductCard';

const MARQUEE_PRODUCTS = [
  { id: 1, title: 'Sony WH-1000XM5 ANC', source: 'Amazon', price: '₹22,990', rating: '4.8', hotDeal: true, priceScore: '0.9412', trustTier: 'A+', verdict: 'Underpriced' },
  { id: 2, title: 'ASUS ROG Zephyrus G14', source: 'Flipkart', price: '₹1,44,990', rating: '4.6', hotDeal: false, priceScore: '0.8200', trustTier: 'S', verdict: 'Fair Value' },
  { id: 3, title: 'LG C3 OLED 55"', source: 'Amazon', price: '₹1,09,990', rating: '4.9', hotDeal: false, priceScore: '0.8850', trustTier: 'A', verdict: 'Excellent' },
  { id: 4, title: 'Apple MacBook Air M3', source: 'Croma', price: '₹1,05,500', rating: '4.9', hotDeal: true, priceScore: '0.9100', trustTier: 'S', verdict: 'Steal Deal' },
  { id: 5, title: 'Samsung Galaxy S24 Ultra', source: 'Amazon', price: '₹1,24,999', rating: '4.7', hotDeal: false, priceScore: '0.7510', trustTier: 'A+', verdict: 'Market Rate' },
  { id: 6, title: 'Nothing Phone (2)', source: 'Flipkart', price: '₹34,990', rating: '4.5', hotDeal: true, priceScore: '0.9630', trustTier: 'B+', verdict: 'High Value' },
  { id: 7, title: 'iPad Air M2 11"', source: 'Apple Store', price: '₹74,900', rating: '4.8', hotDeal: false, priceScore: '0.8300', trustTier: 'S', verdict: 'Premium Pick' },
  { id: 8, title: 'OnePlus 12 256GB', source: 'Amazon', price: '₹64,999', rating: '4.6', hotDeal: true, priceScore: '0.9200', trustTier: 'A', verdict: 'Best Mid-Range' },
];

const HEADLINES = [
  "Find the best laptop",
  "Compare phones instantly",
  "Never overpay again",
  "Autonomous decision-making"
];

export function HeroSection() {
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [dealsAnalyzed, setDealsAnalyzed] = useState(25842);

  // Typewriter rotate
  useEffect(() => {
    const interval = setInterval(() => {
      setHeadlineIndex((prev) => (prev + 1) % HEADLINES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Tick up deals
  useEffect(() => {
    const interval = setInterval(() => {
      setDealsAnalyzed(prev => prev + Math.floor(Math.random() * 5));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full z-10 flex flex-col items-center pt-32 pb-10 pointer-events-none px-4">
      
      {/* Live Counter */}
      <div className="mb-8 px-5 py-2 bg-black/60 backdrop-blur-xl border border-violet-500/30 rounded-full flex items-center gap-3 shadow-[0_0_20px_rgba(139,92,246,0.1)] animate-fade-in-up">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse border border-green-300" />
        <span className="text-zinc-300 text-xs font-mono tracking-widest uppercase">
          {dealsAnalyzed.toLocaleString()} DEALS ANALYZED TODAY
        </span>
      </div>

      {/* Typewriter Headline */}
      <div className="h-24 md:h-32 mb-6 relative w-full flex justify-center text-center">
        <AnimatePresence mode="wait">
          <motion.h1
            key={headlineIndex}
            initial={{ opacity: 0, y: 15, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -15, filter: "blur(8px)" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl md:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-zinc-500 absolute w-full"
          >
            {HEADLINES[headlineIndex]}
          </motion.h1>
        </AnimatePresence>
      </div>

      <p className="text-zinc-400 text-lg md:text-xl max-w-2xl text-center mb-12 drop-shadow-md">
        Enter your desired product. The AI agents will search the web, score features, compare prices, and bring you the absolute best deal.
      </p>

      {/* Smart Search Bar */}
      <div className="w-full max-w-3xl pointer-events-auto relative group animate-fade-in-up">
        {/* Neon Glow Behind Search */}
        <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 rounded-3xl blur-md opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200" />
        
        <div className="relative bg-[#050508]/80 backdrop-blur-2xl border border-violet-500/30 p-2 rounded-3xl flex items-center shadow-2xl">
           <svg className="w-6 h-6 text-violet-400 ml-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
           </svg>
          <input 
            type="text"
            className="w-full bg-transparent text-xl text-white outline-none placeholder:text-zinc-600 px-2 py-4"
            placeholder="e.g., Sony WH-1000XM5 under ₹25k..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                 window.location.href = `/search?q=${encodeURIComponent(query)}`;
              }
            }}
          />
          <button 
            className="px-8 py-4 bg-violet-600 hover:bg-violet-500 rounded-2xl text-white font-semibold transition-colors flex shrink-0 items-center justify-center gap-2"
            onClick={() => {
              if (query.trim()) {
                window.location.href = `/search?q=${encodeURIComponent(query)}`;
              }
            }}
          >
            <span>Deploy Agents</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
            </svg>
          </button>
        </div>
        
        {/* Ghost Verdict Toast */}
        {query.length > 3 && (
           <div className="absolute -bottom-10 left-6 text-xs font-mono text-violet-400/80 flex items-center gap-2 bg-indigo-950/40 px-3 py-1.5 rounded-full border border-indigo-500/20 backdrop-blur-md animate-fade-in-up">
             <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse border border-violet-300" />
             Predicting classification: {query.toLowerCase().includes('laptop') || query.toLowerCase().includes('mac') ? 'Electronics / Computer' : 'Consumer Good'}
           </div>
        )}
      </div>

      <div className="w-full max-w-5xl mt-12 mb-24 animate-fade-in-up pointer-events-auto">
        {/* Product card ticker — single row scrolling left */}
        <div className="w-full overflow-hidden relative">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 h-full w-24 bg-gradient-to-r from-[#050508] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-[#050508] to-transparent z-10 pointer-events-none" />
          <div className="flex w-max animate-[marquee-left_50s_linear_infinite] hover:[animation-play-state:paused]">
            {[...MARQUEE_PRODUCTS, ...MARQUEE_PRODUCTS, ...MARQUEE_PRODUCTS].map((p, i) => (
              <FlippingProductCard key={`ticker-${i}`} item={p} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
