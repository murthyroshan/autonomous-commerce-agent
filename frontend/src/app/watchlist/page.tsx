'use client';

import { useEffect, useState } from 'react';

interface WatchlistItem {
  id?: string;
  title: string;
  current_price: number;
  target_price: number;
  source: string;
  link: string;
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    try {
      const res = await fetch('/api/watchlist?user_id=demo');
      if (!res.ok) throw new Error('Failed to fetch watchlist');
      const data = await res.json();
      setItems(data.watchlist || Object.values(data) || []); 
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (item: WatchlistItem) => {
    try {
      const res = await fetch('/api/watchlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'demo', title: item.title, item_id: item.id ?? '' })
      });
      if (!res.ok) throw new Error('Failed to remove item');
      setItems(prev => prev.filter(i => (item.id ? i.id !== item.id : i.title !== item.title)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove item');
    }
  };

  return (
    <div className="min-h-screen flex flex-col pt-32 px-4 max-w-4xl mx-auto w-full">
      <h1 className="text-4xl font-black tracking-tight text-white mb-8 font-display">Price Watchlist</h1>
      
      {loading && (
          <div className="flex flex-col gap-6 w-full animate-pulse mt-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 w-full bg-white/5 rounded-2xl border border-white/10" />
            ))}
          </div>
      )}

      {error && <p className="text-red-400 text-center mt-20">{error}</p>}

      {items.length === 0 && !loading && !error && (
          <p className="text-zinc-500 text-center mt-20">
              No items being watched. Add a product to your watchlist 
              from the search results.
          </p>
      )}

      {!loading && !error && items.length > 0 && (
         <div className="flex flex-col gap-6 mb-32">
          {items.map((item, idx) => (
             <div key={item.id ?? idx} className="p-6 border border-white/10 rounded-2xl bg-black/40 backdrop-blur flex flex-col sm:flex-row justify-between gap-6 transition-colors hover:border-white/20">
                 
                 <div className="flex-1">
                   {/* Full Title Description */}
                   <h2 className="text-lg font-bold text-white leading-relaxed break-words font-display">
                     {item.title}
                   </h2>
                   
                   <div className="flex items-center flex-wrap gap-3 mt-3">
                     <span className="text-zinc-300 text-xs font-bold uppercase tracking-wider px-2 py-1 bg-white/10 rounded">
                       {item.source || 'Store'}
                     </span>
                     
                     {/* Clearer Source/Website link */}
                     {item.link && (
                       <a href={item.link} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors flex items-center gap-1 bg-blue-400/10 px-2 py-1 rounded">
                         Website Link ↗
                       </a>
                     )}
                   </div>
                 </div>
                 
                 {/* Price Columns */}
                 <div className="flex flex-col sm:items-end flex-shrink-0 min-w-[140px] pt-1">
                   <p className="text-sm text-zinc-400">Current<span className="text-white font-bold text-lg ml-3 font-mono">₹{item.current_price?.toLocaleString() || '-'}</span></p>
                   <p className="text-sm text-zinc-400 mt-2">Target<span className="text-emerald-400 font-bold text-lg ml-3 font-mono">₹{item.target_price?.toLocaleString() || '-'}</span></p>
                 </div>

                 {/* Actions */}
                 <div className="flex-shrink-0 mt-4 sm:mt-0 flex items-center justify-end">
                   <button
                     onClick={() => handleRemove(item)}
                     className="px-5 py-2.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500/20 hover:border-red-500/40 transition-all text-sm font-bold"
                   >
                     Remove
                   </button>
                 </div>
                 
             </div>
          ))}
         </div>
      )}
    </div>
  );
}
