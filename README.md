# Pay Simul

**Payment flow simulation platform** — simulate card, wire, UPI, SEPA, eTransfer, and agentic AI payments across 9 countries with real-time validation, ISO message payloads, fee breakdowns, double-entry ledger accounting, and full audit trails.

---

## Table of Contents

- [Features](#features)
- [Supported Payment Methods](#supported-payment-methods)
- [Supported Countries](#supported-countries)
- [Agentic Payments (AP2 & ACT)](#agentic-payments-ap2--act)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Environment Variables](#environment-variables)
- [Pages & Routes](#pages--routes)
- [API Endpoints](#api-endpoints)
- [Payment Rails Engine](#payment-rails-engine)
- [Validation Engine](#validation-engine)
- [Transaction References](#transaction-references)
- [Fee Calculator](#fee-calculator)
- [Ledger System](#ledger-system)
- [ISO Message Generation](#iso-message-generation)
- [LocalStorage Persistence](#localstorage-persistence)
- [CI/CD Pipeline](#cicd-pipeline)
- [Deployment](#deployment)
- [Security](#security)
- [License](#license)

---

## Features

| Category | What's Built |
|----------|-------------|
| **Payment Simulation** | End-to-end payment flow simulation across 8 payment rails with country-specific logic |
| **Real-time Validation** | Luhn check, card expiry, CVV, UPI ID regex, eTransfer email/mobile, IBAN, account number formats |
| **ISO Messages** | ISO 8583 card payment messages and ISO 20022 (pacs.008) credit transfer payloads |
| **Transaction References** | Auto-generated per rail — ARN, Trace Number, UETR, RTR ID, eTransfer ref, SEPA end-to-end ID, UPI TxnRef |
| **Merchant Order IDs** | Unique 15-digit idempotent order IDs |
| **Fee Breakdown** | Interchange, network fee, and acquirer markup calculated per rail |
| **Ledger Accounting** | Double-entry journal entries for authorization holds and settlement |
| **Agentic Payments** | Full AP2 & ACT protocol simulation with 7-step interactive workflow powered by Gemini AI |
| **Audit Trails** | Cryptographically-linked audit entries with immutable hash chains |
| **Payment Flow Animation** | Visual step-by-step flow: Merchant → Acquirer → Network → Issuer → Response → Settlement |
| **JSON Payload Viewer** | Syntax-highlighted payload viewer for generated messages |
| **Transaction History** | Persistent transaction log with filtering by rail, status, and amount |
| **Dark Mode** | System-aware theme toggle with manual override |
| **Responsive UI** | Tailwind CSS-based layout with collapsible sidebar navigation |
| **SEO** | Dynamic `robots.txt` and `sitemap.xml` generation |
| **Error Handling** | React error boundaries, global error handler, and custom 404 page |

---

## Supported Payment Methods

| # | Method | Standard | Use Case |
|---|--------|----------|----------|
| 1 | **Credit / Debit Card** | ISO 8583 | Online and POS card payments |
| 2 | **ACH Transfer** | NACHA | US bank-to-bank transfers |
| 3 | **Wire Transfer** | ISO 20022 (pacs.008) | High-value / cross-border SWIFT payments |
| 4 | **RTR (Real-Time Rail)** | Real-time payment rails | Instant domestic transfers |
| 5 | **eTransfer (Interac)** | Interac protocol | Canadian person-to-person transfers |
| 6 | **Digital Wallet** | Proprietary | Apple Pay, Google Pay, PayPal-style wallets |
| 7 | **SEPA** | ISO 20022 | European cross-border euro transfers |
| 8 | **UPI** | NPCI UPI | Indian real-time mobile payments |

---

## Supported Countries

| Country | Code | Available Payment Methods |
|---------|------|--------------------------|
| United States | US | Card, ACH, Wire, Wallet |
| Canada | CA | Card, eTransfer, Wire, RTR, Wallet |
| United Kingdom | GB | Card, Wire, RTR, SEPA, Wallet |
| Germany | DE | Card, Wire, SEPA, Wallet |
| France | FR | Card, Wire, SEPA, Wallet |
| India | IN | Card, UPI, Wire, Wallet |
| Singapore | SG | Card, Wire, RTR, Wallet |
| Japan | JP | Card, Wire, Wallet |
| Australia | AU | Card, Wire, RTR, Wallet |

Each country enforces its own validation rules (account number formats, bank codes, routing numbers, IBANs, etc.) through the country-specific account validation module.

---

## Agentic Payments (AP2 & ACT)

The platform implements a full **Agentic Payment Protocol (AP2)** and **Agent Commerce Toolkit (ACT)** simulation — a 7-step interactive workflow where an AI agent autonomously handles a payment on behalf of a user.

### Workflow Steps

| Step | Phase | Description |
|------|-------|-------------|
| 1 | **User Intent** | User describes what they want to buy in natural language |
| 2 | **Agent Search** | AI agent searches for products/merchants matching intent |
| 3 | **Cart Building** | Agent builds a shopping cart with selected items and prices |
| 4 | **Verification** | Cart is verified against user constraints and budget |
| 5 | **Mandate Creation** | An intent mandate and cart mandate are generated with delegation constraints |
| 6 | **Payment Execution** | Simulated payment flow using the chosen rail |
| 7 | **Audit Trail** | Immutable, hash-chained audit trail from intent through settlement |

### Key Concepts

- **Intent Mandates** — Capture user intent with delegation constraints (amount limits, merchant categories, time windows)
- **Cart Mandates** — Lock items and prices for payment authorization
- **Agent Identity** — Verifiable credentials for the autonomous agent
- **Delegation Constraints** — Budget caps, allowed merchant categories, expiry windows
- **Interaction Modes** — Human-present (supervised) and human-not-present (autonomous)
- **Gemini AI Integration** — Google Gemini 2.0 Flash powers intent analysis, cart building, and verification

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.x |
| Language | TypeScript (strict mode) | 5.x |
| UI Runtime | React | 18.x |
| Styling | Tailwind CSS | 3.x |
| AI Integration | Google Generative AI (Gemini 2.0 Flash) | 0.24.x |
| Linting | ESLint (Next.js core-web-vitals) | 8.x |
| Formatting | Prettier | 3.x |
| Runtime | Node.js | >= 18.17.0 |
| Deployment | Vercel | — |
| CI/CD | GitHub Actions + Dependabot | — |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js App Router                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │Dashboard │ │Payments  │ │Agentic   │ │Transactions│  │
│  │  page    │ │Simulator │ │Dashboard │ │   Log      │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│       │             │            │              │        │
│  ┌────▼─────────────▼────────────▼──────────────▼────┐  │
│  │              Component Layer                       │  │
│  │  PaymentsSimulatorDashboard │ AgenticPaymentDash   │  │
│  │  PayloadViewer │ PaymentFlowAnimation │ Sidebar    │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │                                │
│  ┌──────────────────────▼────────────────────────────┐  │
│  │              Business Logic (lib/)                 │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │  │
│  │  │Payment   │ │Validation│ │  Agentic Engine   │   │  │
│  │  │Rails     │ │Engine    │ │  (AP2 + ACT)      │   │  │
│  │  │Engine    │ │          │ │  + Gemini AI       │   │  │
│  │  └────┬─────┘ └──────────┘ └──────────────────┘   │  │
│  │       │                                            │  │
│  │  ┌────▼─────┐ ┌──────────┐ ┌─────────┐ ┌──────┐  │  │
│  │  │ISO 8583  │ │ISO 20022 │ │   Fee   │ │Ledger│  │  │
│  │  │Generator │ │Generator │ │  Calc   │ │Engine│  │  │
│  │  └──────────┘ └──────────┘ └─────────┘ └──────┘  │  │
│  │                                                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │  │
│  │  │Order ID  │ │Txn Ref   │ │  UPI QR Code     │   │  │
│  │  │Generator │ │Generator │ │  Generator        │   │  │
│  │  └──────────┘ └──────────┘ └──────────────────┘   │  │
│  └────────────────────────────────────────────────────┘  │
│                         │                                │
│  ┌──────────────────────▼────────────────────────────┐  │
│  │         Persistence (LocalStorage)                 │  │
│  │  transactions │ order IDs │ method usage stats     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │         API Layer (/api/agentic)                   │  │
│  │  POST → Gemini AI → intent / cart / verify phases  │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
pay-simul/
├── app/                            # Next.js App Router pages
│   ├── api/
│   │   └── agentic/
│   │       └── route.ts            # POST endpoint for Gemini AI agentic payments
│   ├── agentic/
│   │   ├── page.tsx                # Agentic payments dashboard
│   │   └── loading.tsx             # Loading skeleton
│   ├── payments/
│   │   ├── page.tsx                # Payment simulation page
│   │   └── loading.tsx             # Loading skeleton
│   ├── transactions/
│   │   ├── page.tsx                # Transaction log viewer
│   │   └── loading.tsx             # Loading skeleton
│   ├── settings/
│   │   ├── page.tsx                # Settings page
│   │   └── loading.tsx             # Loading skeleton
│   ├── layout.tsx                  # Root layout (Sidebar + Header + ErrorBoundary)
│   ├── page.tsx                    # Dashboard home page
│   ├── loading.tsx                 # Root loading state
│   ├── error.tsx                   # Route-level error boundary
│   ├── global-error.tsx            # Global error handler
│   ├── not-found.tsx               # Custom 404 page
│   ├── globals.css                 # Tailwind CSS global styles
│   ├── robots.ts                   # Dynamic robots.txt generation
│   └── sitemap.ts                  # Dynamic sitemap.xml generation
│
├── components/                     # React components
│   ├── ui/                         # Reusable UI primitives
│   │   ├── Badge.tsx               # Status badges
│   │   ├── CardContainer.tsx       # Card wrapper component
│   │   ├── SectionTitle.tsx        # Section header component
│   │   └── StatusPill.tsx          # Status indicator pills
│   ├── layout/
│   │   └── PageHeader.tsx          # Page header with breadcrumb
│   ├── AgenticPaymentDashboard.tsx # 7-step agentic payments workflow (~1,300 lines)
│   ├── PaymentsSimulatorDashboard.tsx  # Payment simulator form + results (~1,700 lines)
│   ├── Sidebar.tsx                 # Navigation sidebar with payment method submenu
│   ├── AppHeader.tsx               # Top header bar with theme toggle
│   ├── ThemeToggle.tsx             # Dark/light mode toggle
│   ├── PayloadViewer.tsx           # JSON payload syntax-highlighted viewer
│   ├── PaymentFlowAnimation.tsx    # Visual payment flow animation
│   ├── ErrorBoundary.tsx           # React error boundary component
│   └── Toast.tsx                   # Toast notification component
│
├── config/                         # Application configuration
│   ├── app.ts                      # App name, version constants
│   ├── rails.ts                    # Payment methods, countries, currencies, originators
│   └── country-methods.ts          # Country → payment method mapping
│
├── lib/                            # Business logic & engines
│   ├── agentic/                    # Agentic payments protocol engine
│   │   ├── index.ts                # Public API exports
│   │   ├── types.ts                # AP2/ACT type definitions
│   │   ├── mandate.ts              # Mandate creation & validation logic
│   │   └── gemini.ts               # Gemini AI integration (intent, cart, verify)
│   ├── payment-rails/              # Payment rail implementations
│   │   ├── PaymentRail.ts          # Base PaymentRail interface
│   │   ├── index.ts                # Rail registry & exports
│   │   ├── types.ts                # Rail type definitions
│   │   └── rails/                  # Individual rail implementations
│   │       ├── Iso8583Rail.ts      # Credit/debit card (ISO 8583)
│   │       ├── Iso20022Rail.ts     # Wire transfer / SEPA (ISO 20022)
│   │       ├── InteracRail.ts      # Interac eTransfer
│   │       ├── RtrRail.ts          # Real-Time Rail
│   │       ├── UpiRail.ts          # UPI payments
│   │       ├── WeChatRail.ts       # WeChat Pay
│   │       └── WalletRail.ts       # Digital wallets
│   ├── validation/                 # Input validation
│   │   ├── card.ts                 # Card number (Luhn), expiry, CVV validation
│   │   └── country-accounts.ts     # Country-specific account/IBAN validation
│   ├── generators/                 # ID & reference generators
│   │   ├── order-id.ts             # 15-digit merchant order IDs
│   │   └── transaction-ref.ts      # Per-rail transaction references
│   ├── iso20022/                   # ISO 20022 message generation
│   │   ├── index.ts                # Public exports
│   │   └── pacs008/                # pacs.008 Credit Transfer
│   │       ├── index.ts
│   │       ├── generator.ts        # XML message generator
│   │       └── types.ts            # Message type definitions
│   ├── iso8583/                    # ISO 8583 message generation
│   │   ├── index.ts                # Public exports
│   │   ├── generator.ts            # Card message bitmap generator
│   │   └── types.ts                # Field type definitions
│   ├── upi/                        # UPI payment support
│   │   ├── index.ts                # Public exports
│   │   ├── qr-generator.ts         # UPI QR code string generation
│   │   ├── simulation.ts           # UPI flow simulation
│   │   └── types.ts                # UPI type definitions
│   ├── wallet/                     # Digital wallet support
│   │   ├── index.ts                # Public exports
│   │   ├── simulation.ts           # Wallet flow simulation
│   │   └── types.ts                # Wallet type definitions
│   ├── fee-calculator/             # Fee calculation engine
│   │   ├── index.ts                # Public exports
│   │   ├── calculator.ts           # Per-rail fee logic
│   │   └── types.ts                # Fee type definitions
│   ├── ledger/                     # Accounting ledger engine
│   │   ├── index.ts                # Public exports
│   │   ├── engine.ts               # Double-entry journal entry generation
│   │   └── types.ts                # Ledger type definitions
│   ├── store/                      # LocalStorage persistence
│   │   ├── transactions.ts         # Transaction history (last 20 records)
│   │   └── method-usage.ts         # Payment method usage statistics
│   ├── logging/                    # Simulation logging
│   │   └── simulation.ts           # Structured simulation log output
│   ├── data/                       # Demo/test data
│   │   └── demo-cards.ts           # Test card numbers for simulation
│   └── types/                      # Shared type definitions
│       └── simulation.ts           # Simulation record types
│
├── .github/
│   ├── workflows/
│   │   └── ci.yml                  # CI pipeline (lint, typecheck, build)
│   └── dependabot.yml              # Weekly dependency updates
│
├── .env.example                    # Environment variable template
├── .eslintrc.json                  # ESLint configuration
├── next.config.js                  # Next.js config with security headers
├── tailwind.config.js              # Tailwind CSS config (dark mode, accent color)
├── postcss.config.js               # PostCSS config
├── tsconfig.json                   # TypeScript strict mode config
├── vercel.json                     # Vercel deployment config
└── package.json                    # Dependencies & scripts
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.17.0
- **npm** >= 9

### Installation

```bash
git clone https://github.com/<your-org>/pay-simul.git
cd pay-simul
npm ci
cp .env.example .env.local
```

To enable **Agentic Payments**, add your Gemini API key to `.env.local`:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run preflight   # Verify types + lint + build all pass
npm run build       # Production build
npm run start       # Start production server
```

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Dev server | `npm run dev` | Start Next.js development server on port 3000 |
| Build | `npm run build` | Create optimized production build |
| Start | `npm run start` | Start production server |
| Lint | `npm run lint` | Run ESLint with Next.js core-web-vitals rules |
| Lint fix | `npm run lint:fix` | Auto-fix lint issues |
| Type check | `npm run typecheck` | TypeScript strict mode type checking (`tsc --noEmit`) |
| Format | `npm run format` | Format all files with Prettier |
| Format check | `npm run format:check` | Check formatting without writing |
| Preflight | `npm run preflight` | Full pre-deploy check: typecheck → lint → build |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_APP_NAME` | No | `Pay Simul` | Application display name |
| `NEXT_PUBLIC_VERSION` | No | `0.1.0` | Application version |
| `GEMINI_API_KEY` | For agentic | — | Google Gemini API key for AI-powered agentic payments |
| `NEXT_PUBLIC_ENABLE_AGENTIC` | No | `true` | Feature flag to enable/disable agentic payments UI |
| `VERCEL_URL` | Auto | — | Set automatically by Vercel during deployment |

---

## Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Overview of the platform with feature highlights |
| `/payments` | Payment Simulator | Form-based payment simulation with validation, payload generation, fee breakdown, ledger entries, and flow animation |
| `/agentic` | Agentic Payments | 7-step AI-powered autonomous payment workflow (AP2 & ACT) |
| `/transactions` | Transaction Log | Filterable transaction history (by rail, status, amount range) |
| `/settings` | Settings | App configuration display |

### API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/agentic` | Unified endpoint for Gemini-powered agentic payment phases |

---

## API Endpoints

### `POST /api/agentic`

Processes agentic payment phases using Google Gemini 2.0 Flash.

**Request body:**

```json
{
  "phase": "intent | cart | verify",
  "userMessage": "Buy me noise-cancelling headphones under $300",
  "constraints": { "maxAmount": 300, "categories": ["electronics"] },
  "cartItems": [{ "name": "Sony WH-1000XM5", "price": 279.99 }]
}
```

**Phases:**

| Phase | Input | Output | Description |
|-------|-------|--------|-------------|
| `intent` | `userMessage` | `IntentAnalysis` | Extracts structured intent and constraints from natural language |
| `cart` | `constraints` | `CartRecommendation` | Builds shopping cart matching constraints |
| `verify` | `cartItems`, `constraints` | `VerificationAnalysis` | Verifies cart against budget and constraints |

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | Unknown phase |
| 503 | `GEMINI_API_KEY` not configured |
| 500 | Server error (includes `fallback: true` flag) |

---

## Payment Rails Engine

Each payment rail implements the `PaymentRail` interface:

```typescript
interface PaymentRail {
  generateMessage(params): PaymentMessage;       // ISO message payload
  simulateAuthorization(params): AuthResult;      // Auth simulation
  calculateFees(amount): FeeBreakdown;            // Fee calculation
  generateLedgerEntries(params): JournalEntry[];  // Accounting entries
}
```

### Implemented Rails

| Rail | File | Standard | Message Format |
|------|------|----------|---------------|
| Card (Credit/Debit) | `Iso8583Rail.ts` | ISO 8583 | Bitmap-based field messages |
| Wire Transfer | `Iso20022Rail.ts` | ISO 20022 | XML pacs.008 credit transfer |
| SEPA | `Iso20022Rail.ts` | ISO 20022 | XML pacs.008 with SEPA rules |
| ACH | `Iso20022Rail.ts` | NACHA | Simplified ACH batch format |
| RTR | `RtrRail.ts` | Real-time | RTR message format |
| eTransfer | `InteracRail.ts` | Interac | eTransfer request format |
| UPI | `UpiRail.ts` | NPCI UPI | UPI collect/pay request |
| Digital Wallet | `WalletRail.ts` | Proprietary | Wallet token-based message |
| WeChat Pay | `WeChatRail.ts` | Proprietary | WeChat unified order format |

---

## Validation Engine

### Card Validation (`lib/validation/card.ts`)

- **Luhn algorithm** — Validates card numbers
- **Expiry date** — MM/YY format with future-date check
- **CVV** — 3 or 4 digit validation
- **Card type detection** — Visa, Mastercard, Amex, Discover from BIN ranges

### Country-Specific Account Validation (`lib/validation/country-accounts.ts`)

- **US** — Routing number (9 digits, ABA checksum) + account number
- **CA** — Transit number (5 digits) + institution number (3 digits) + account number
- **GB** — Sort code (6 digits) + account number (8 digits)
- **DE/FR** — IBAN validation with country-specific length and checksum
- **IN** — IFSC code (11 chars) + account number
- **SG** — Bank code + branch code + account number
- **JP** — Bank code (4 digits) + branch code (3 digits) + account number
- **AU** — BSB (6 digits) + account number

---

## Transaction References

Each payment rail generates its own reference format:

| Rail | Reference Type | Format | Example |
|------|---------------|--------|---------|
| Card | ARN (Acquirer Reference Number) | 23 digits | `74927364510029384756102` |
| Card | Auth Code | 6 alphanumeric | `A3F9K2` |
| ACH | Trace Number | 15 digits | `091000019283746` |
| Wire | UETR (Unique End-to-end Txn Reference) | UUID v4 (36 chars) | `f47ac10b-58cc-4372-a567-0e02b2c3d479` |
| RTR | Transaction ID | 20 alphanumeric | `RTR20240115A3F9K2B7D1` |
| eTransfer | Reference Number | 12 alphanumeric | `CA3F9K2B7D1E` |
| SEPA | End-to-end ID | Max 35 chars | `SEPA-20240115-A3F9K2B7D1` |
| UPI | Transaction Reference ID | 12 digits | `384756102938` |
| Wallet | Transaction ID | 17 alphanumeric | `WLT20240115A3F9K2` |

**Merchant Order IDs** — 15-digit unique idempotent identifiers generated per transaction, stored in LocalStorage to prevent duplicates (max 500 stored).

---

## Fee Calculator

The fee engine calculates a three-part breakdown per transaction:

| Component | Description | Varies By |
|-----------|-------------|-----------|
| **Interchange** | Fee paid to the issuing bank / card network | Card type, rail, region |
| **Network Fee** | Fee charged by the payment scheme/switch | Rail, transaction type |
| **Acquirer Markup** | Fee retained by the processor/acquirer | Acquirer, merchant agreement |

Each rail has its own fee schedule defined in the fee calculator module.

---

## Ledger System

The ledger engine generates **double-entry journal entries** for each transaction phase:

### Authorization Phase

| Account | Debit | Credit |
|---------|-------|--------|
| Authorization Hold | Amount | — |
| Payer Account | — | Amount |

### Settlement Phase

| Account | Debit | Credit |
|---------|-------|--------|
| Payer Account | Amount | — |
| Merchant Account | — | Net Amount |
| Fee Revenue | — | Fee Amount |

Journal entries are generated by `lib/ledger/engine.ts` and displayed alongside transaction results.

---

## ISO Message Generation

### ISO 8583 (Card Payments)

Generated by `lib/iso8583/generator.ts`:

- MTI (Message Type Indicator): `0100` (authorization), `0200` (financial)
- Bitmap encoding with standard data elements
- Fields: PAN, processing code, amount, transmission date/time, STAN, expiry, POS entry mode, acquiring institution, card acceptor terminal ID, name/location, currency code

### ISO 20022 (Wire / SEPA)

Generated by `lib/iso20022/pacs008/generator.ts`:

- Message type: `pacs.008.001.08` (FI-to-FI Customer Credit Transfer)
- Full XML document with:
  - Group header (message ID, creation date/time, number of transactions, settlement method)
  - Credit transfer transaction info (end-to-end ID, amount, charge bearer, debtor/creditor agent BICs, debtor/creditor names and accounts)

---

## LocalStorage Persistence

The app uses browser LocalStorage for client-side persistence:

| Key | Max Records | Description |
|-----|-------------|-------------|
| `payflow_transactions` | 20 | Recent transaction simulation records |
| `payflow_generated_order_ids` | 500 | Generated merchant order IDs (dedup) |
| `payflow_method_usage` | — | Payment method usage statistics |

---

## CI/CD Pipeline

### GitHub Actions (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main`:

| Job | What It Does |
|-----|-------------|
| **Lint** | ESLint with Next.js core-web-vitals rules |
| **Type Check** | TypeScript strict mode compilation |
| **Build** | Full production build verification |

### Dependabot (`.github/dependabot.yml`)

- **npm** — Weekly dependency updates
- **GitHub Actions** — Weekly workflow dependency updates

### Vercel

- **Production** — Auto-deploys on push to `main`
- **Preview** — Auto-deploys on every pull request

---

## Deployment

### Vercel (Recommended)

1. Push your repository to GitHub
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. Vercel auto-detects Next.js — click **Deploy**
4. Set `GEMINI_API_KEY` in Vercel dashboard → Settings → Environment Variables (if using agentic payments)

### Manual Deployment

```bash
npm run preflight   # Verify types + lint + build
npm run build       # Production build
npm run start       # Start production server (port 3000)
```

---

## Security

The following security headers are configured in `next.config.js`:

| Header | Value | Protection |
|--------|-------|-----------|
| `X-Frame-Options` | `DENY` | Clickjacking prevention |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing prevention |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | HTTPS enforcement (HSTS) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer leakage prevention |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Feature restrictions |
| `X-Powered-By` | *(removed)* | Technology fingerprint removal |

---

## License

MIT
