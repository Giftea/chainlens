# ChainLens 2.0

AI-Powered Smart Contract Documentation Generator for BNB Chain.

## Features

- **AI Documentation Generation** - Generate comprehensive docs from any verified BSC contract using Claude AI
- **Interactive Contract Playground** - Auto-generate UI for reading/writing contract functions
- **Contract Version Diffing** - AST-based comparison with breaking change detection
- **Dependency Graph Visualization** - Interactive cross-contract dependency mapping
- **Security Analysis** - AI-powered vulnerability detection and recommendations
- **Multi-format Export** - Download as Markdown, PDF, or HTML
- **IPFS Storage + Onchain Registry** - Permanent storage with onchain verification

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn UI |
| AI | Claude API (@anthropic-ai/sdk) |
| Web3 | ethers v6, MetaMask |
| Parsing | @solidity-parser/parser (AST) |
| Visualization | React Flow, D3.js, Recharts |
| Code Editor | Monaco Editor |
| Storage | Pinata (IPFS) |
| Smart Contracts | Hardhat, Solidity 0.8.24, OpenZeppelin |

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask browser extension
- API keys (see below)

### Installation

```bash
# Clone and enter the project
cd chainlens

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Fill in your API keys in .env
```

### Environment Variables

| Variable | Description | Required |
|----------|------------|----------|
| `ANTHROPIC_API_KEY` | Claude AI API key | Yes |
| `NEXT_PUBLIC_BSCSCAN_API_KEY` | BSCScan API key | Yes |
| `NEXT_PUBLIC_PINATA_JWT` | Pinata IPFS JWT | For IPFS |
| `BSC_PRIVATE_KEY` | Deployer wallet private key | For deploy |
| `BSC_RPC_URL` | Custom BSC RPC endpoint | No |

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:3000
```

### Smart Contracts

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to BSC Testnet
npx hardhat run src/contracts/deploy.ts --network bscTestnet

# Verify on BSCScan
npx hardhat verify --network bscTestnet <DEPLOYED_ADDRESS>
```

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
chainlens/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx            # Landing page
│   │   ├── generate/           # Documentation generator
│   │   ├── explore/            # Contract explorer/playground
│   │   ├── diff/               # Version diffing
│   │   └── api/                # API routes
│   ├── components/             # React components
│   │   ├── ui/                 # Shadcn UI components
│   │   ├── DocGenerator.tsx    # Main doc generation form
│   │   ├── DocViewer.tsx       # Documentation viewer with tabs
│   │   ├── ContractPlayground.tsx  # Interactive contract UI
│   │   ├── DiffViewer.tsx      # Contract diff viewer
│   │   ├── DependencyGraph.tsx # React Flow dependency graph
│   │   └── WalletConnect.tsx   # MetaMask wallet connection
│   ├── lib/                    # Core logic
│   │   ├── contractFetcher.ts  # BSCScan API integration
│   │   ├── documentationGenerator.ts  # Claude AI integration
│   │   ├── astParser.ts        # Solidity AST parsing
│   │   ├── abiAnalyzer.ts      # ABI analysis for playground
│   │   ├── diffEngine.ts       # AST-based contract diffing
│   │   ├── dependencyMapper.ts # Dependency graph builder
│   │   ├── ipfsUploader.ts     # Pinata IPFS integration
│   │   ├── web3Client.ts       # ethers.js setup
│   │   └── exporters/          # MD, PDF, HTML exporters
│   ├── contracts/              # Solidity smart contracts
│   │   ├── DocRegistry.sol     # Onchain documentation registry
│   │   ├── deploy.ts           # Deployment script
│   │   └── test/               # Contract tests
│   ├── types/                  # TypeScript type definitions
│   └── config/                 # Network configurations
├── hardhat.config.ts
├── tailwind.config.ts
├── next.config.mjs
└── package.json
```

## API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate` | POST | Generate AI documentation |
| `/api/fetch-contract` | POST | Fetch contract source from BSCScan |
| `/api/diff` | POST | Compare two contracts |
| `/api/export` | POST | Export documentation |
| `/api/upload-ipfs` | POST | Upload to IPFS via Pinata |

## License

MIT
