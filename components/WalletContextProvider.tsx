import React, { FC, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { WalletConnectWalletAdapter } from '@solana/wallet-adapter-walletconnect';
import {
    SolanaMobileWalletAdapter,
    createDefaultAuthorizationResultCache,
    createDefaultAddressSelector,
    createDefaultWalletNotFoundHandler
} from '@solana-mobile/wallet-adapter-mobile';
import {
    SOLANA_NETWORK,
    SOLANA_RPC_ENDPOINT,
    WALLETCONNECT_PROJECT_ID,
    WALLETCONNECT_RELAY_URL,
    APP_METADATA
} from '../constants/solana';

require('@solana/wallet-adapter-react-ui/styles.css');

const WalletContextProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
    // Memoize endpoint to avoid rerenders
    const endpoint = useMemo(() => SOLANA_RPC_ENDPOINT, []);
    const network = SOLANA_NETWORK;

    const wallets = useMemo(() => {
        if (typeof window === 'undefined') {
            return [];
        }

        // Dynamic URI to ensure MWA matches the current sub-domain (preventing "Malicious App" or silent rejection)
        const currentOrigin = window.location.origin;
        const iconUrl = `${currentOrigin}/favicon.ico`;

        return [
            // 1. Mobile Wallet Adapter (Android/iOS Native)
            // Prioritized for mobile experience to avoid browser conflicts
            new SolanaMobileWalletAdapter({
                addressSelector: createDefaultAddressSelector(),
                appIdentity: {
                    name: APP_METADATA.name,
                    uri: currentOrigin, // Must match the actual browser URL
                    icon: iconUrl
                },
                authorizationResultCache: createDefaultAuthorizationResultCache(),
                cluster: network,
                onWalletNotFound: createDefaultWalletNotFoundHandler()
            }),
            // 2. WalletConnect (Trust Wallet, Metamask, others)
            // Critical: Needs Project ID and Relay URL
            new WalletConnectWalletAdapter({
                network: network,
                options: {
                    projectId: WALLETCONNECT_PROJECT_ID,
                    relayUrl: WALLETCONNECT_RELAY_URL,
                    metadata: {
                        name: APP_METADATA.name,
                        description: APP_METADATA.description,
                        url: currentOrigin,
                        icons: [iconUrl]
                    }
                }
            })
        ];
    }, [network]);

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

export default WalletContextProvider;
