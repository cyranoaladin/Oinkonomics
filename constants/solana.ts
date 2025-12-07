import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';

// Determine the network based on environment variable
export const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_TESTNET === 'true'
    ? WalletAdapterNetwork.Devnet
    : WalletAdapterNetwork.Mainnet;

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
    uri: 'https://oinkonomics.vercel.app/',
    icon: '/favicon.ico',
    description: 'Oinkonomics NFT Mint'
};
