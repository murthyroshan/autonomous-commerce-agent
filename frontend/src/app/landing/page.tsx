'use client';
import { CursorGlow } from '@/components/landing/CursorGlow';
import { HorizontalTicker } from '@/components/landing/HorizontalTicker';
import { HeroSection } from '@/components/landing/HeroSection';
import { BlockchainStrip } from '@/components/landing/BlockchainStrip';
import { LiveToast } from '@/components/landing/LiveToast';
import { GlassHeader } from '@/components/landing/GlassHeader';
import { BattleModeCard } from '@/components/landing/BattleModeCard';
import { NegotiationCard } from '@/components/landing/NegotiationCard';
import { TerminalShowcase } from '@/components/landing/TerminalShowcase';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#050508] text-white selection:bg-violet-500/50 overflow-x-hidden font-sans">
      
      {/* Noise Texture Overlay */}
      <div 
        className="pointer-events-none fixed inset-0 z-0 opacity-10"
        style={{
           backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
           backgroundRepeat: 'repeat',
           backgroundSize: '128px 128px'
        }}
      />

      {/* Global Background Gradients */}
      <div className="fixed inset-0 z-[1] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/10 via-[#050508] to-[#050508] pointer-events-none" />

      {/* Floating Header */}
      <GlassHeader />

      {/* Mouse Track Glow */}
      <CursorGlow />
      <LiveToast />

      {/* The Parallax Ticker Feed */}
      <HorizontalTicker />

      {/* Hero Content (Centered) */}
      <div className="relative z-10 w-full min-h-screen pt-12 flex flex-col justify-between">
          <div className="absolute inset-0 bg-gradient-to-b from-[#050508]/20 via-transparent to-[#050508] pointer-events-none z-0" />
          <HeroSection />
          <div className="w-full mt-auto relative z-20">
             <BlockchainStrip />
          </div>
      </div>

      {/* Below the fold sections */}
      <div className="relative z-20 w-full bg-[#050508] pt-32 px-4 flex flex-col items-center">
         <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-20 text-center shadow-black drop-shadow-2xl">
            How the agent outsmarts the market
         </h2>
         
         <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
             <BattleModeCard />
             <NegotiationCard />
         </div>

         {/* Raw Developer Payload */}
         <TerminalShowcase />

         {/* Final Massive CTA */}
         <div className="w-full max-w-4xl border-t border-violet-500/10 mt-16 pt-40 pb-48 flex flex-col items-center text-center">
             <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-600 tracking-tighter mb-12">
               Stop scrolling.<br />
               <span className="text-violet-500">Deploy agents.</span>
             </h1>
             <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-10 py-5 bg-white text-black font-extrabold rounded-full hover:scale-105 transition-transform hover:bg-zinc-200 shadow-[0_10px_40px_rgba(255,255,255,0.2)] text-lg tracking-wider uppercase"
             >
                Return to Search
             </button>
         </div>
      </div>

    </div>
  );
}
