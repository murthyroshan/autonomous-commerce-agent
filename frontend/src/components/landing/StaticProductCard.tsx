'use client';

export function StaticProductCard({ item }: { item: any }) {
  return (
    <div className="w-[340px] h-[180px] flex-shrink-0 mx-4 my-2 relative bg-black/90 border border-violet-500/20 rounded-2xl p-5 flex flex-col justify-between overflow-hidden">
        {/* Minimal flat representation without heavy 3D or expensive nested filters/shadows */}
        <div className="flex justify-between items-start relative z-10 w-full">
            <div className="flex flex-col gap-1 w-full flex-1 pr-2">
            <h3 className="text-white font-semibold line-clamp-1">{item.title}</h3>
            <p className="text-violet-400/80 text-xs tracking-wider uppercase font-semibold">{item.source}</p>
            </div>
            {item.hotDeal && (
            <span className="px-2 py-1 bg-green-950/40 text-green-400 text-[10px] font-bold rounded flex items-center justify-center uppercase tracking-wider relative z-10 border border-green-500/30 shrink-0">
                HOT DEAL
            </span>
            )}
        </div>

        <div className="flex justify-between items-end relative z-10 w-full mt-auto">
            <p className="text-3xl font-bold text-white tracking-tighter">{item.price}</p>
            <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded">
            <span className="text-yellow-400 text-xs">★</span>
            <span className="text-zinc-300 text-xs font-medium">{item.rating}</span>
            </div>
        </div>
    </div>
  );
}
