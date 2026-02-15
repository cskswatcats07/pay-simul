# Pay Simul

**Payment flow simulation platform** — simulate card, wire, UPI, SEPA, eTransfer, and agentic AI payments across 9 countries with real-time validation, ISO 20022 payloads, and full audit trails.

## Features

- **8 Payment Methods**: Card, ACH, Wire (ISO 20022), RTR, eTransfer, Wallet, SEPA, UPI
- **9 Countries**: US, CA, GB, DE, FR, IN, SG, JP, AU with country-specific validation
- **Real-time Validation**: Luhn check, expiry date, UPI ID regex, eTransfer email/mobile
- **Transaction References**: Auto-generated per payment type (ARN, Trace, UETR, etc.)
- **Merchant Order IDs**: Unique 15-digit idempotent IDs
- **Agentic Payments**: Full AP2 & ACT protocol simulation with 7-step interactive workflow
- **Audit Trails**: Cryptographically-linked audit entries with hash chains
- **Dark Mode**: System-aware theme toggle
- **ISO 20022 Payloads**: SWIFT/wire message generation with parsed views

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| Runtime | React 18 |
| Deployment | Vercel |
| CI/CD | GitHub Actions |

## Getting Started

### Prerequisites

- Node.js >= 18.17.0
- npm >= 9

### Installation

```bash
git clone https://github.com/<your-org>/pay-simul.git
cd pay-simul
npm ci
cp .env.example .env.local
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run typecheck` | TypeScript type checking |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting |
| `npm run preflight` | Full pre-deploy check (types + lint + build) |

## Project Structure

```
pay-simul/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Dashboard
│   ├── payments/           # Payment simulation
│   ├── agentic/            # Agentic payments
│   ├── transactions/       # Transaction log
│   ├── settings/           # Settings
│   ├── robots.ts           # SEO robots
│   └── sitemap.ts          # SEO sitemap
├── components/             # React components
│   ├── PaymentsSimulatorDashboard.tsx
│   ├── AgenticPaymentDashboard.tsx
│   ├── Sidebar.tsx
│   └── ui/                 # Reusable UI primitives
├── config/                 # App configuration
│   ├── rails.ts            # Payment methods, countries, currencies
│   └── country-methods.ts  # Country → method mapping
├── lib/                    # Business logic
│   ├── agentic/            # AP2 & ACT protocol engine
│   ├── validation/         # Card, account validation
│   ├── generators/         # Order ID, transaction ref generation
│   ├── upi/                # UPI QR code generator
│   └── store/              # localStorage persistence
├── .github/
│   ├── workflows/ci.yml    # CI pipeline
│   └── dependabot.yml      # Dependency updates
├── vercel.json             # Vercel deployment config
└── next.config.js          # Next.js config with security headers
```

## CI/CD Pipeline

The GitHub Actions pipeline runs on every push and PR to `main`:

1. **Lint** — ESLint with Next.js core-web-vitals rules
2. **Type Check** — TypeScript strict mode compilation
3. **Build** — Full production build verification

Vercel automatically deploys:
- **Production** on push to `main`
- **Preview** on every pull request

Dependabot keeps dependencies updated weekly.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APP_NAME` | No | App display name (default: "Pay Simul") |
| `NEXT_PUBLIC_VERSION` | No | App version |
| `VERCEL_URL` | Auto | Set automatically by Vercel |

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project at [vercel.com/new](https://vercel.com/new)
3. Vercel auto-detects Next.js — click Deploy
4. Set environment variables in Vercel dashboard if needed

### Manual

```bash
npm run preflight   # Verify everything passes
npm run build       # Production build
npm run start       # Start production server
```

## Security

- `X-Frame-Options: DENY` — Clickjacking protection
- `X-Content-Type-Options: nosniff` — MIME sniffing protection
- `Strict-Transport-Security` — HSTS with preload
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — Camera, microphone, geolocation disabled
- `poweredByHeader: false` — No X-Powered-By header

## License

MIT
