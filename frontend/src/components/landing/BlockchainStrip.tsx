'use client';
import { useEffect, useState } from 'react';

const HASHES = [
  "TX: 8fA2...391a — 1 mALGO",
  "TX: 2cB9...442b — 1 mALGO",
  "TX: 9xV1...001c — 1 mALGO",
  "TX: 11Pq...889z — 1 mALGO",
  "TX: 5aF4...112x — 1 mALGO",
  "TX: 7oM2...556y — 1 mALGO",
  "TX: 3bN8...991k — 1 mALGO",
];

export function BlockchainStrip() {
  return (
    <div className="w-full bg-[#050508] border-t border-b border-indigo-500/10 py-4 overflow-hidden flex items-center relative z-20">
       <div className="absolute left-0 w-32 h-full bg-gradient-to-r from-[#050508] to-transparent z-10" />
       <div className="absolute right-0 w-32 h-full bg-gradient-to-l from-[#050508] to-transparent z-10" />
       
       <div className="flex w-max animate-[marquee-left_25s_linear_infinite] items-center gap-12 pr-12">
          {[...HASHES, ...HASHES, ...HASHES, ...HASHES].map((hash, i) => (
             <div key={i} className="flex items-center gap-3 text-xs font-mono shrink-0">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                <span className="text-green-500/80 text-[10px] border border-green-500/20 bg-green-500/10 px-2 py-0.5 rounded-full tracking-widest">VERIFIED ON-CHAIN</span>
                <span className="text-zinc-500">{hash}</span>
             </div>
          ))}
       </div>
    </div>
  );
}
