Create PHASE7_BRAIN.md in the project root with this exact content:

# PHASE7_BRAIN.md — God-Level UI Reference

## What we're building
Kartiq Phase 7 is a complete frontend overhaul.
The aesthetic is "Oxidized Precision" — Bloomberg Terminal
meets Teenage Engineering. No purple AI gradients.

## Design tokens location
frontend/src/design-system/tokens.ts
frontend/src/design-system/animations.ts

## Color rules — NEVER break these
- Backgrounds: #0a0a09 base, #111110 surface1, #18181a surface2
- Primary accent: #e8a045 (amber) — CTAs, winners, confirmed
- Data accent: #00d4aa (cyan) — live data, streaming, active
- Danger: #ff4d4d — errors, suspicious prices
- Text: #f2f2f0 primary, #888884 secondary, #444440 muted
- NO purple except badge tier2 (#7c6af7)
- NO gradients on backgrounds
- NO blue anywhere in the app UI

## Typography rules — NEVER break these
- Headings: Syne font (font-display class)
- Body: Inter font
- Prices, scores, TX IDs, data: JetBrains Mono (font-mono class)
- Prices ALWAYS in JetBrains Mono
- Weights: 400, 500, 600 ONLY — never 700+

## Animation rules
- Always use framer-motion for component animations
- Always use spring transitions (never ease-in-out)
- Blur (4px) on enter, clear on settle — signals depth
- Never animate purely for decoration
- Duration: 80ms micro, 200ms transitions, 300-400ms reveals

## Component locations
- Base UI: frontend/src/components/ui/
- Agent-specific: frontend/src/components/agent/
- Product: frontend/src/components/product/
- Layout: frontend/src/components/layout/

## State management
- Global app state: Zustand store at frontend/src/stores/
- Server state: React Query
- No React Context for global state

## Key CSS classes (defined in globals.css)
- .noise          — adds grain texture via ::before
- .scanlines      — adds faint scan lines via ::after
- .spotlight      — cursor-reactive glow on cards
- .skeleton       — shimmer loading state
- .cursor-blink   — animated cursor for typing effects
- .dot-pulse      — three-dot wave loader
- .border-run     — animated running light border
- .glow-amber     — amber box shadow glow
- .glow-cyan      — cyan box shadow glow
- .score-bar      — score bar container
- .score-bar-fill — score bar fill (transition on width)

## Agent pipeline states
The UI has 5 states driven by Zustand agentState:
  IDLE       → ambient, search bar ready
  CLARIFYING → chat bubbles asking questions
  SEARCHING  → border-run animation on search, AgentTimeline visible
  COMPARING  → score bars filling live, counter ticking
  DONE       → winner card glowing amber, others dimmed to 60%

## What Part 2–7 will build
Part 2: Search experience (SearchOrb, ChatFlow, AgentTimeline)
Part 3: Product display (ProductCard, ProductGrid, CompareDrawer)
Part 4: Landing page (hero, demo, storytelling)
Part 5: History + Watchlist dashboard
Part 6: Advanced chatbot with RAG memory
Part 7: Infrastructure (caching, logging, rate limiting)

## Every Part prompt starts with:
"Read PHASE7_BRAIN.md before writing any code.
Apply design tokens from frontend/src/design-system/tokens.ts.
Follow all rules in the brain file without exception."