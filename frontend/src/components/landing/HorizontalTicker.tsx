'use client';
import { FlippingProductCard } from './FlippingProductCard';

const DUMMY_PRODUCTS = [
  { id: 1, title: 'Sony WH-1000XM5 ANC', source: 'Amazon', price: '₹22,990', rating: '4.8', hotDeal: true, priceScore: '0.9412', trustTier: 'A+', verdict: 'Underpriced' },
  { id: 2, title: 'ASUS ROG Zephyrus G14', source: 'Flipkart', price: '₹144,990', rating: '4.6', hotDeal: false, priceScore: '0.8200', trustTier: 'S', verdict: 'Fair Value' },
  { id: 3, title: 'LG C3 OLED 55"', source: 'Amazon', price: '₹109,990', rating: '4.9', hotDeal: false, priceScore: '0.8850', trustTier: 'A', verdict: 'Excellent' },
  { id: 4, title: 'Apple MacBook Air M3', source: 'Croma', price: '₹105,500', rating: '4.9', hotDeal: true, priceScore: '0.9100', trustTier: 'S', verdict: 'Steal Deal' },
  { id: 5, title: 'Samsung S24 Ultra', source: 'Amazon', price: '₹124,999', rating: '4.7', hotDeal: false, priceScore: '0.7510', trustTier: 'A+', verdict: 'Market Rate' },
  { id: 6, title: 'Nothing Phone (2)', source: 'Flipkart', price: '₹34,990', rating: '4.5', hotDeal: true, priceScore: '0.9630', trustTier: 'B+', verdict: 'High Value' },
];

export function HorizontalTicker() {
  const ROW_1 = [...DUMMY_PRODUCTS, ...DUMMY_PRODUCTS, ...DUMMY_PRODUCTS];
  const ROW_2 = [...DUMMY_PRODUCTS].reverse().concat([...DUMMY_PRODUCTS].reverse()).concat([...DUMMY_PRODUCTS].reverse());
  const ROW_3 = [
    ...DUMMY_PRODUCTS.slice(2), ...DUMMY_PRODUCTS.slice(0, 2),
    ...DUMMY_PRODUCTS.slice(2), ...DUMMY_PRODUCTS.slice(0, 2),
    ...DUMMY_PRODUCTS.slice(2), ...DUMMY_PRODUCTS.slice(0, 2),
  ];

  return (
    <div className="absolute w-[150vw] -left-[25vw] h-full z-0 overflow-hidden flex flex-col justify-center gap-6 opacity-30 transform -rotate-2 select-none pointer-events-auto">
      
      {/* Row 1 - Left to Right (Fast) */}
      <div className="flex w-max relative animate-[marquee-right_30s_linear_infinite]">
        {ROW_1.map((p, i) => (
           <FlippingProductCard key={`r1-${i}`} item={p} />
        ))}
      </div>

      {/* Row 2 - Right to Left (Slow) */}
      <div className="flex w-max relative animate-[marquee-left_45s_linear_infinite]">
        {ROW_2.map((p, i) => (
           <FlippingProductCard key={`r2-${i}`} item={p} />
        ))}
      </div>

      {/* Row 3 - Left to Right (Medium) */}
      <div className="flex w-max relative animate-[marquee-right_40s_linear_infinite]">
        {ROW_3.map((p, i) => (
           <FlippingProductCard key={`r3-${i}`} item={p} />
        ))}
      </div>

    </div>
  );
}
