'use client';

import { useEffect, useState } from 'react';

interface HistoryItem {
  id?: string;
  tx_id?: string;
  app_id?: number;
  escrow_status?: string;
  title: string;
  price: number;
  source: string;
  link?: string;
  timestamp: string | number;
}

interface NFTReceipt {
  asset_id: number;
  asset_url: string;
  receipt_number: number;
  tx_id: string;
  timestamp: string;
  product_title?: string;
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [nfts, setNfts] = useState<NFTReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/history?user_id=demo');
        if (!res.ok) throw new Error('Failed to fetch history');
        const data = await res.json();
        setItems(data.history || Object.values(data) || []); 
        
        try {
            const nftsRes = await fetch('/api/nfts?user_id=demo');
            if (nftsRes.ok) {
                const nftsData = await nftsRes.json();
                setNfts(nftsData.nfts || []);
            }
        } catch (e) {
            console.error("Failed to fetch nfts", e);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const handleEscrowAction = async (appId: number, action: 'confirm' | 'refund') => {
    try {
        setActionLoading(appId);
        const endpoint = action === 'confirm' ? '/api/escrow/confirm_delivery' : '/api/escrow/refund';
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: 'demo', app_id: appId })
        });
        if (!res.ok) {
           const errData = await res.json();
           throw new Error(errData.detail || `Failed to ${action}`);
        }
        
        // Update local state
        setItems(prev => prev.map(item => 
            item.app_id === appId 
                ? { ...item, escrow_status: action === 'confirm' ? 'delivered' : 'refunded' }
                : item
        ));
    } catch (err) {
        alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
        setActionLoading(null);
    }
  }

  return (
    <div className="relative z-10 min-h-screen flex flex-col pt-32 px-4 max-w-4xl mx-auto w-full">
      <div className="mb-16 mt-4 flex flex-col items-center text-center">
        <div
          className="mb-6 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
          style={{
            borderColor: 'rgba(124,58,237,0.4)',
            background: 'rgba(124,58,237,0.1)',
            color: '#a78bfa',
          }}
        >
          <span style={{ color: '#7c3aed' }}>✦</span>
          Algorand Testnet
        </div>
        <h1 
          className="mb-4 text-5xl font-extrabold tracking-tighter sm:text-7xl text-transparent bg-clip-text font-display"
          style={{ backgroundImage: 'linear-gradient(135deg, #c4b5fd 0%, #a855f7 50%, #3b82f6 100%)' }}
        >
          Purchase History
        </h1>
        <p className="max-w-md text-lg font-medium text-purple-200/70 tracking-wide">
          Your immutable commerce log, secured on the blockchain.
        </p>
      </div>
      
      {loading && (
          <div className="flex flex-col gap-6 w-full animate-pulse mt-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 w-full bg-white/5 rounded-2xl border border-white/10" />
            ))}
          </div>
      )}

      {error && <p className="text-red-400 text-center mt-20">{error}</p>}

      {items.length === 0 && !loading && !error && (
          <p className="text-zinc-500 text-center mt-20">
              No purchase history yet. Confirm a product to see it here.
          </p>
      )}

      {!loading && !error && items.length > 0 && (
         <div className="flex flex-col gap-6 mb-32">
          {items.map((item, idx) => {
             // Find matching NFT by title (if any)
             const matchingNft = nfts.find((nft) => nft.product_title === item.title);
             return (
             <div key={idx} className="p-6 border border-white/10 rounded-2xl bg-black/40 backdrop-blur flex flex-col gap-5">
                 
                 {/* Top section: Title, Links & Description */}
                 <div className="flex flex-col sm:flex-row justify-between gap-6">
                     <div className="flex-1">
                       {/* Full description / title */}
                       <h2 className="text-lg font-bold text-white leading-relaxed break-words font-display">{item.title}</h2>
                       <div className="flex items-center flex-wrap gap-3 mt-3">
                         <span className="text-zinc-300 text-xs font-bold uppercase tracking-wider px-2 py-1 bg-white/10 rounded">
                           {item.source || 'Store'}
                         </span>
                         
                         {/* Website Link */}
                         {item.link && (
                            <a href={item.link} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors flex items-center gap-1 bg-blue-400/10 px-2 py-1 rounded">
                                Website Link ↗
                            </a>
                         )}
                       </div>
                     </div>
                     
                     <div className="flex flex-col sm:items-end flex-shrink-0 min-w-[140px]">
                       <p className="font-black text-3xl text-white tracking-tight font-mono">₹{item.price?.toLocaleString() || '-'}</p>
                       <p className="text-xs text-zinc-500 mt-2 font-medium">
                         {item.timestamp ? (() => {
                           const d = new Date(item.timestamp);
                           const hours = d.getHours();
                           const ampm = hours >= 12 ? 'PM' : 'AM';
                           const h12 = hours % 12 || 12;
                           const m = d.getMinutes().toString().padStart(2, '0');
                           return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()} · ${h12}:${m} ${ampm}`;
                         })() : 'Just now'}
                       </p>
                     </div>
                 </div>

                 {/* Bottom section: Blockchain & Escrow Actions */}
                 <div className="pt-4 border-t border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                     
                     {/* Tx and Smart Contract Links */}
                     <div className="flex flex-wrap items-center gap-2">
                         {item.tx_id && !item.tx_id.startsWith('local-') ? (
                           <a 
                             href={`https://testnet.explorer.perawallet.app/tx/${item.tx_id}`} 
                             target="_blank" 
                             rel="noreferrer"
                             className="text-xs font-mono text-emerald-400 hover:text-emerald-300 bg-emerald-400/10 px-3 py-1.5 rounded-full transition-colors break-all"
                           >
                             Tx: {item.tx_id.substring(0, 16)}... ↗
                           </a>
                         ) : item.tx_id ? (
                           <span className="text-xs text-zinc-500 bg-white/5 px-3 py-1.5 rounded-full">
                             Local Order
                           </span>
                         ) : null}

                         {item.app_id && (
                           <a 
                             href={`https://testnet.explorer.perawallet.app/application/${item.app_id}`} 
                             target="_blank" 
                             rel="noreferrer"
                             className="text-xs font-mono text-purple-400 hover:text-purple-300 bg-purple-400/10 px-3 py-1.5 rounded-full transition-colors"
                           >
                             Smart Contract #{item.app_id} ↗
                           </a>
                         )}
                         
                         {matchingNft?.asset_url && (
                           <a
                             href={matchingNft.asset_url}
                             target="_blank"
                             rel="noreferrer"
                             className="text-xs font-mono text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
                           >
                             <span className="text-sm leading-none">🧾</span>
                             View Proof of Purchase (NFT) ↗
                           </a>
                         )}
                     </div>

                     {/* Cancellation / Escrow Confirm Buttons */}
                     {item.app_id && item.escrow_status === 'locked' && (
                         <div className="flex items-center gap-3">
                            <button
                               disabled={actionLoading === item.app_id}
                               onClick={() => handleEscrowAction(item.app_id!, 'refund')}
                               className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                            >
                               {actionLoading === item.app_id ? 'Processing...' : 'Cancel Order'}
                            </button>
                            <button
                               disabled={actionLoading === item.app_id}
                               onClick={() => handleEscrowAction(item.app_id!, 'confirm')}
                               className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                            >
                               {actionLoading === item.app_id ? 'Processing...' : 'Confirm Delivery'}
                            </button>
                         </div>
                     )}

                     {/* Completed Escrow Status Banner */}
                     {item.escrow_status && item.escrow_status !== 'locked' && (
                         <span className={`text-xs font-bold px-4 py-2 rounded-xl uppercase tracking-wider ${
                           item.escrow_status === 'delivered' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'
                         }`}>
                            {item.escrow_status === 'delivered' ? 'Order Complete' : 'Order Cancelled'}
                         </span>
                     )}
                 </div>

              </div>
           );
          })}
          </div>
       )}
    </div>
  );
}
