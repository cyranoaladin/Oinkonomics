import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';

// Determine the network based on environment variable
// Determine the network based on environment variable (Defaults to DEVNET for this project phase)
// Crucial: Mismatch between Mainnet adapter and Devnet RPC causes connection failures on mobile
export const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_TESTNET === 'false'
    ? WalletAdapterNetwork.Mainnet
    : WalletAdapterNetwork.Devnet;

// Determine the RPC Endpoint
// Priorities:
// 1. HELIUS_API_KEY (if server-side or allowed) - Optimized
// 2. NEXT_PUBLIC_RPC_URL (Custom RPC)
// 3. clusterApiUrl (Public fallback - effectively rate limited)
export const SOLANA_RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_URL
    || clusterApiUrl(SOLANA_NETWORK);

// WalletConnect Configuration
export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'cf0f4c50b8001a0045e9b9f3971dbdc0'; // Fallback for immediate fix
export const WALLETCONNECT_RELAY_URL = 'wss://relay.walletconnect.com';

export const APP_METADATA = {
    name: 'Oinkonomics',
    uri: 'https://oinkonomics-mfai.vercel.app', // Update to actual production domain
    icon: 'https://oinkonomics-mfai.vercel.app/favicon.ico', // Absolute URL required for Mobile Wallet Adapter
    description: 'Oinkonomics NFT Mint'
};
