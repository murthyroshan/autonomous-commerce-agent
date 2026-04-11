# Frontend Setup (Phase 3)

Next.js 14 UI with real-time agent status streaming via SSE.

## Scaffold

```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
npx shadcn-ui@latest init
npx shadcn-ui@latest add card badge button input
```

## Environment

Create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Files to create

```
src/
├── app/
│   ├── page.tsx               ← main search page
│   └── layout.tsx
├── components/
│   ├── SearchBar.tsx           ← query input + submit button
│   ├── StatusTicker.tsx        ← live SSE status messages
│   ├── ProductCard.tsx         ← single product with score bar
│   ├── ProductGrid.tsx         ← responsive product grid
│   └── ErrorBanner.tsx         ← amber warning when error set
└── hooks/
    └── useAgentStream.ts       ← EventSource hook for SSE
```

## Key hook — `useAgentStream.ts`

```typescript
import { useState, useEffect } from 'react'

export function useAgentStream(query: string | null) {
  const [status, setStatus]   = useState('')
  const [result, setResult]   = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query) return
    setLoading(true)
    setResult(null)

    const url = `${process.env.NEXT_PUBLIC_API_URL}/api/search/stream?query=${encodeURIComponent(query)}`
    const es = new EventSource(url)

    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'result') { setResult(data); setLoading(false); es.close() }
      else if (data.type === 'error') { setStatus(data.message); setLoading(false); es.close() }
      else if (data.type === 'status') { setStatus(data.message) }
    }

    es.onerror = () => { setLoading(false); es.close() }
    return () => es.close()
  }, [query])

  return { status, result, loading }
}
```

## ProductCard score bar

```tsx
// Score as percentage width bar
<div style={{ width: `${Math.round(product.score * 100)}%` }}
     className="h-1 bg-blue-500 rounded" />
```

Winner card styling:
```tsx
className={`border rounded-lg p-4 ${isWinner ? 'border-2 border-blue-500' : 'border'}`}
```

## Run the frontend

```bash
cd frontend
npm run dev
# Opens at http://localhost:3000
```

Make sure the FastAPI backend is running at `http://localhost:8000` first.
