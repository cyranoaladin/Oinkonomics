# Environment Configuration

This document describes the environment variables required to run Oinkonomics in different network profiles (Devnet vs Mainnet).

## Profiles

### Devnet (Default)
Used for development and testing.
- `NEXT_PUBLIC_SOLANA_TESTNET`: `true` (or unset)
- `NEXT_PUBLIC_RPC_URL`: `https://api.devnet.solana.com` (or your custom devnet RPC)

### Mainnet Beta
Used for production.
- `NEXT_PUBLIC_SOLANA_TESTNET`: `false`
- `NEXT_PUBLIC_RPC_URL`: Your premium Mainnet RPC URL (Helius, QuickNode, etc.)

## Required Variables

### Network & RPC
| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_SOLANA_TESTNET` | `'true'` for Devnet, `'false'` for Mainnet | `true` |
| `NEXT_PUBLIC_RPC_URL` | Full RPC Endpoint URL | `https://api.devnet.solana.com` |

### WalletConnect
| Variable | Description | Required? |
|----------|-------------|-----------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Project ID from WalletConnect Cloud | Yes (for mobile) |

### Security
| Variable | Description | Required? |
|----------|-------------|-----------|
| `JWT_SECRET` | Secret key for signing auth cookies | Yes (in production) |

### NFT / Candy Machine Configuration
These must match the deployed Candy Machine on the selected network.

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CANDY_MACHINE_ID` | Address of the Candy Machine Account |
| `NEXT_PUBLIC_CANDY_GUARD_ID` | Address of the Candy Guard Account |
| `NEXT_PUBLIC_COLLECTION_MINT` | Address of the Collection NFT Mint |
| `NEXT_PUBLIC_COLLECTION_AUTHORITY` | Update Authority of the Collection |
| `NEXT_PUBLIC_PAYMENT_DESTINATION` | Wallet address receiving mint payments |
