import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';

// Determine the network based on environment variable
// Determine the network based on environment variable (Defaults to DEVNET for this project phase)
// Crucial: Mismatch between Mainnet adapter and Devnet RPC causes connection failures on mobile
// MOB-02: Network profile alignment
export const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_TESTNET === 'false'
    ? WalletAdapterNetwork.Mainnet
    : WalletAdapterNetwork.Devnet;

export const SOLANA_RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl(SOLANA_NETWORK);

// MOB-04: WalletConnect Configuration
if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
    console.warn('[WalletConnect] Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID – mobile may fail.');
}

export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';
export const WALLETCONNECT_RELAY_URL = 'wss://relay.walletconnect.com';

export const APP_METADATA = {
    name: 'Oinkonomics',
    uri: 'https://oinkonomics-mfai.vercel.app', // Update to actual production domain
    icon: 'https://oinkonomics-mfai.vercel.app/favicon.ico', // Absolute URL required for Mobile Wallet Adapter
    description: 'Oinkonomics NFT Mint'
};
