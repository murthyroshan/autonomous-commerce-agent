# 🚀 KartIQ: Autonomous Commerce Agent
> Zero-friction autonomous commerce. Discover, evaluate, and securely execute Web3 transactions via a unified, multi-modal AI pipeline.

# 📌 The Proposition
The modern e-commerce experience is broken by scale. Consumers suffer severe decision fatigue attempting to decode disjointed search algorithms, fabricated reviews, and subjective pricing manipulation. 

**KartIQ resolves this by fully automating the discovery, evaluation, and execution lifecycle.**

It functions as a strict autonomous pipeline intersecting natural language processing, predictive market mapping, and decentralized finance. KartIQ retrieves live structured data, objectively normalizes ranking metrics mathematically, dictates an unbiased recommendation, and securely finalizes the checkout through an immutable Algorand-backed escrow payload.

# 🧠 Core Concept: The Autonomous Commerce Protocol
An **Autonomous Commerce Agent** shifts the paradigm from *assistive AI* to *executing AI*. 

Rather than serving endless pagination and disorganized external links, the agent interprets complex constraints—such as *"Find the best 4K monitor for color grading under $500"*—and executes the raw operational labor. It aggregates unstructured data, normalizes the statistics, synthesizes a definitive conclusion, and initiates a cryptographic transaction. It collapses the buyer's journey from a prolonged, manual funnel into a singular, mathematically justified action.

# ⚙️ Platform Capabilities
- **Deterministic Intent Analysis:** Translates abstract natural language queries into strict functional and budgetary bounds utilizing Llama 3 logic parsing.
- **Live Market Telemetry:** Ingests unstructured search topologies and live market data across domains via Serper capabilities.
- **Zero-Bias Normalization Engine:** Employs a zero-trust Min-Max scalar algorithm that mathematically enforces price-to-performance indexing prior to LLM evaluation.
- **Explainable AI (XAI) Justification:** Forces the LLM to strictly defend algorithmic outputs without granting it permission to fabricate underlying numerical data topologies.
- **Immutable Audit Logging:** Commits verifiable intent-to-purchase hashes natively to the Algorand testnet ledger to establish strict historical provenance.
- **Trustless Algorand Checkout:** Decentralized financial rails bridging AI autonomy with strict cryptographic user-consent boundaries via WalletConnect.
- **Asynchronous Pipeline Streaming:** Low-latency Server-Sent Events (SSE) pipeline architecture delivering sub-second execution state shifts directly to the interactive client.

# 🏗️ System Architecture
KartIQ relies on a decoupled, pipeline-driven architecture engineered for high concurrency and strict node modularity.

- **Presentation Layer (Frontend):** A high-performance, edge-ready Next.js 14 application leveraging Tailwind CSS and Framer Motion. It acts as the consumption layer for the asynchronous SSE streams and explicitly handles the Pera Wallet integration layer.
- **API Control Plane (Backend):** A robust FastAPI and Uvicorn server orchestrating asynchronous subroutines and exposing strictly-typed, validated Pydantic data schemas.
- **Agent Mesh (AI Layer):** A sequential, LangGraph-inspired state machine composing three highly specialized nodes:
  - `search_agent`: Mangles semantic intent into structured search parameters and sanitizes live market telemetry.
  - `compare_agent`: Handles scalar computational normalization over arrays (0–1 baseline).
  - `decision_agent`: Uses the Groq LLM endpoint to execute deterministic recommendations strictly against normalized vectors.
- **Web3 Settlement Layer (Blockchain):** A testnet interface built on `py-algorand-sdk` and the AlgoNode RPC for generating, encoding, and broadcasting secure payload transactions.

# ⛓️ Blockchain Integration: The Financial Rail for Autonomy
Allowing an AI agent to execute purchases necessitates impenetrable security boundaries. The Algorand integration acts as the fundamental financial rail for this autonomy.
- **The Web3 Necessity:** Traditional APIs require storing highly sensitive credit card data. Cryptographic signing empowers the AI to structure a secure intent, while the user strictly maintains private key control on their mobile device. 
- **Smart Contract Escrow Concepts:** By generating raw binary `PaymentTxn` packets, funds can be temporarily locked in a decentralized escrow state until order fulfillment is mathematically proven.
- **Permissioned Autonomy:** The Pera Wallet integration completely sandboxes the AI pipeline. The agent proposes the optimal allocation; the user cryptographically authorizes the execution. 
- **Execution Flow:** Frontend payload parameters -> Backend transaction synthesis -> Encoded msgpack base64 pushed to Client -> Signed via Pera Mobile SDK -> Network propagation at the node level.

# 🛠️ Tech Stack
- **Languages:** TypeScript, Python 3.11
- **Frontend Ecosystem:** Next.js 14, React, Tailwind CSS, Framer Motion
- **Backend Ecosystem:** FastAPI, Uvicorn, Pydantic, asyncio
- **AI/LLM Infrastructure:** Groq Developer API (`llama-3.3-70b-versatile`)
- **Market Data:** Serper.dev (Live Google Shopping API)
- **Web3 / Blockchain:** Algorand Testnet, `py-algorand-sdk`, `@perawallet/connect`

# 📂 Project Structure
```text
autonomous-commerce-agent/
├── agents/             # AI Pipeline Logic & State Machine Subroutines
│   ├── compare_agent.py   # Statistical scalar normalization implementation
│   ├── decision_agent.py  # Groq LLM evaluation & XAI formatting
│   ├── pipeline.py        # Central sequence orchestration
│   └── search_agent.py    # Search query proxying and DOM data extraction
├── api/                # Backend API Implementation
│   ├── main.py            # FastAPI Entrypoint & Middleware bindings
│   ├── models.py          # Pydantic Schemas for I/O validation
│   └── routes.py          # SSE Streaming & Rest API endpoints
├── blockchain/         # Web3 Network Layer
│   └── algorand.py        # Transaction bytecode generation & TxN broadcast
├── frontend/           # Presentation Layer Virtual DOM
│   ├── src/app            # Next.js Server Components & App Router
│   ├── src/components     # Complex Interactive Client Components
│   └── src/hooks          # State Management for Web3 Client SDKs
└── tests/              # Pytest verification and integration suites
```

# ⚡ Getting Started

## Prerequisites
- Node.js v18+
- Python 3.11+
- Groq API Key
- Serper.dev API Key

## Local Installation

1. **Clone the repository:**
```bash
git clone https://github.com/murthyroshan/autonomous-commerce-agent.git
cd autonomous-commerce-agent
```

2. **Initialize the Backend Context:**
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

3. **Initialize the Frontend Context:**
```bash
cd frontend
npm install
cd ..
```

## Environment Configuration
Create a `.env` file in the root based strictly on `.env.example`:

```env
GROQ_API_KEY=your_groq_api_key
SERPER_API_KEY=your_serper_api_key
ALGORAND_MNEMONIC=your_testnet_wallet_mnemonic
ALGORAND_RECEIVER=your_receiving_testnet_address
MOCK_ONLY=false
```

## Running the Platform

Boot the core API plane:
```bash
uvicorn api.main:app --reload --port 8000
```

Boot the presentation layer (in an isolated terminal):
```bash
cd frontend
npm run dev
```

# 🔌 API Integrations
- **Groq API**: High-speed, edge-inference Llama 3 endpoint utilized strictly for deep intent analysis and human-readable rationale synthesis.
- **Serper API**: Interacts sequentially with the Google Shopping DOM to retrieve and unmarshal live product topography metrics.
- **AlgoNode RPC**: High-throughput public Algorand testnet connectivity ensuring stable contract compilation and sub-second transaction propagation.

# 🤖 System Architecture Flow
1. **Semantic Reception:** The user inputs abstract functional variables into the Next.js client.
2. **State Injection:** The core API intercepts the variables and maps them into the synchronized `AgentState`.
3. **Market Mapping:** The `search_agent` invokes Serper.dev algorithms, isolating top matches and automatically dropping erratic or irrelevant domain objects.
4. **Computational Normalization:** The `compare_agent` evaluates the array natively using a `0-1` scalar normalization formula that aggressively inverts price weights and cascades review density metrics.
5. **Final Matrix Evaluation:** The structured data is explicitly quarantined from LLM hallucination and passed to the `decision_agent`, which generates a semantic justification mapping algorithm variables to user constraints.
6. **Asynchronous Presentation:** Real-time state updates cascade through the SSE pipeline directly causing staggered, high-framerate renders across the browser client.
7. **Execution & Settlement:** A WalletConnect signature intent is securely routed to the user's mobile device. Upon cryptographic network signature, the final intent is committed permanently to the Algorand testnet ledger.

# 🔐 Threat Abstraction & Verification
The proposition of autonomous commerce demands zero-trust architecture. By hashing and storing purchase intents, numerical metadata configurations, and settled checkout payloads strictly on the Algorand ledger, KartIQ establishes a highly auditable, transparent state. This strictly guarantees that backend processes cannot subvert, modify, or disguise the rationale backing an AI's operational decision, ensuring absolute provenance.

# 🚧 Architectural Challenges & Mitigations
- **Challenge - LLM Numerical Hallucination:** Language models naturally fabricate non-existent product geometries or distort operational pricing to artificially satisfy user constraints.
  - **Mitigation:** Strict execution segregation. The LLM is restricted completely to evaluating pre-computed statistical parameters and operates under a zero-permission policy regarding raw data generation.
- **Challenge - Pera SDK Asynchronous State Desync:** WalletConnect capabilities frequently suffer from caching desynchronization across React hot-reloads resulting in ghost-connections.
  - **Mitigation:** Authored explicit bypass logic inside the `usePeraWallet` hook to dodge React state closure latency and verify hardware-level `.connector` presence dynamically prior to any signature request.
- **Challenge - High-Latency Scraping Pipelines:** Blocking user interactions while awaiting asynchronous web scraping creates intolerable UI/UX latency.
  - **Mitigation:** Implemented a Server-Sent Events (SSE) pipeline establishing a persistent, uni-directional HTTP connection that yields modular JSON artifacts consecutively as individual LangGraph nodes finish computing.

# 🔮 Innovation Roadmap
- **Advanced Escrow Execution:** Transitioning simple Algorand `PaymentTxn` packets into full Turing-complete PyTeal ASC1 contract protocols holding programmatic capital until post-shipment logistics APIs fire.
- **Adversarial Agent Networks:** Embedding multi-agent architectures that simulate internal debates—allowing a secondary 'Critic Agent' to challenge the 'Decision Agent' output to eliminate residual LLM biases.
- **Proprietary Vendor Graphs:** Migrating away from generic DOM scraping towards proprietary integrations with Shopify Graph APIs or Amazon Web Services fulfillment environments for frictionless operational scale.

# 🤝 Contribution Guidelines
Engineering contributions scaling system capability are openly welcomed:
1. Fork the baseline repository.
2. Isolate your feature (`git checkout -b feature/ImplementationName`).
3. Commit logical changes (`git commit -m 'Implement ImplementationName'`).
4. Push to remote (`git push origin feature/ImplementationName`).
5. Open an issue-referenced Pull Request.

# 📜 License
This architecture remains proprietary software actively belonging to its respective ownership. All rights explicitly reserved.
