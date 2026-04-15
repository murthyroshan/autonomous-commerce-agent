'use client';

const ACTIVITIES = [
  "Agent Initialised",
  "Searching 'gaming laptop under ₹80,000'",
  "Comparing 25+ retail sources",
  "Normalizing review sentiment...",
  "Recommendation found: Sony WH-1000XM5",
  "Verifying store trust tier...",
  "Applying Min-Max weighted scoring",
  "Searching '4K OLED TV under ₹60,000'",
  "Executing smart contract escrow on Algorand",
  "Analyzing Reddit community consensus",
];

export function AgentActivityStrip() {
  return (
    <div className="w-full bg-[#050508]/50 backdrop-blur-sm border-t border-b border-violet-500/10 py-3 overflow-hidden flex items-center relative z-20">
       <div className="absolute left-0 w-32 h-full bg-gradient-to-r from-[#050508] to-transparent z-10" />
       <div className="absolute right-0 w-32 h-full bg-gradient-to-l from-[#050508] to-transparent z-10" />
       
       <div className="flex w-max animate-[marquee-right_40s_linear_infinite] items-center gap-16 pr-16">
          {[...ACTIVITIES, ...ACTIVITIES, ...ACTIVITIES, ...ACTIVITIES].map((text, i) => (
             <div key={i} className="flex items-center gap-3 text-sm font-mono shrink-0">
                <span className="w-2 h-2 bg-violet-500 rounded-sm animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
                <span className="text-zinc-500 uppercase tracking-widest">{text}</span>
             </div>
          ))}
       </div>
    </div>
  );
}
